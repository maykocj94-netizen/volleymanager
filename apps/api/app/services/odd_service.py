"""Sistema de Odds: o dono cria apostas; usuários apostam; o dono liquida.

- Apostar debita o valor da carteira (prata/ouro) na hora.
- Liquidar (definir o vencedor): cada aposta no lado vencedor recebe
  ceil(valor × multiplicador) — SEMPRE arredondado para cima. As perdedoras
  não recebem nada. Cancelar a Odd devolve o valor de todas as apostas.
"""

import math
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.odd import Odd, OddBet
from app.models.user_state import UserState
from app.repositories.user_repo import UserRepository
from app.services.user_service import InsufficientFunds, NotFound


class OddError(Exception):
    """Erro de regra de aposta (Odd fechada, lado inválido, etc.)."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def payout_for(amount: int, odd_value: float) -> int:
    """Pagamento da aposta vencedora: ceil(valor × multiplicador)."""
    return int(math.ceil(amount * float(odd_value)))


def _odd_dict(o: Odd, bet_count: int = 0) -> dict:
    return {
        "id": o.id, "title": o.title, "type": o.type, "description": o.description,
        "team_a_name": o.team_a_name, "team_a_odd": o.team_a_odd,
        "team_b_name": o.team_b_name, "team_b_odd": o.team_b_odd,
        "status": o.status, "winner": o.winner, "bet_count": bet_count,
    }


def _bet_ctx(b: OddBet, o: Odd | None) -> dict:
    return {
        "id": b.id, "odd_id": b.odd_id, "selection": b.selection,
        "currency": b.currency, "amount": b.amount, "odd_value": b.odd_value,
        "status": b.status, "payout": b.payout,
        "odd_title": o.title if o else "",
        "team_a_name": o.team_a_name if o else "",
        "team_b_name": o.team_b_name if o else "",
        "odd_status": o.status if o else "",
        "odd_winner": o.winner if o else None,
    }


class OddService:
    """Operações do usuário: ver odds abertas, apostar, minhas apostas."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _my_bets_for(self, user_id: uuid.UUID, odd_id: uuid.UUID) -> list[OddBet]:
        stmt = select(OddBet).where(
            OddBet.user_id == user_id, OddBet.odd_id == odd_id
        ).order_by(OddBet.created_at.desc())
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_open(self, user_id: uuid.UUID) -> list[dict]:
        stmt = select(Odd).where(Odd.status == "open").order_by(Odd.created_at.desc())
        odds = (await self.session.execute(stmt)).scalars().all()
        out: list[dict] = []
        for o in odds:
            count = await self.session.scalar(
                select(func.count()).select_from(OddBet).where(OddBet.odd_id == o.id)
            ) or 0
            d = _odd_dict(o, int(count))
            mine = await self._my_bets_for(user_id, o.id)
            d["my_bets"] = [_bet_ctx(b, o) for b in mine]
            out.append(d)
        return out

    async def place_bet(
        self, user_id: uuid.UUID, odd_id: uuid.UUID, selection: str, currency: str, amount: int
    ) -> tuple[UserState, OddBet, Odd]:
        if selection not in ("a", "b"):
            raise OddError("Lado inválido.")
        if amount <= 0:
            raise OddError("Informe um valor de aposta válido.")
        odd = await self.session.get(Odd, odd_id)
        if odd is None or odd.status != "open":
            raise NotFound("Aposta indisponível (fechada ou removida).")

        state = await UserRepository(self.session).get_or_create_state(user_id)
        bal = state.gold if currency == "gold" else state.silver
        if bal < amount:
            raise InsufficientFunds(
                f"Saldo insuficiente: precisa de {amount} de {'ouro' if currency == 'gold' else 'prata'}."
            )
        if currency == "gold":
            state.gold -= amount
        else:
            state.silver -= amount

        odd_value = odd.team_a_odd if selection == "a" else odd.team_b_odd
        bet = OddBet(
            id=uuid.uuid4(), odd_id=odd_id, user_id=user_id, selection=selection,
            currency=currency, amount=amount, odd_value=float(odd_value), status="pending",
        )
        self.session.add(bet)
        await self.session.flush()
        return state, bet, odd

    async def my_bets(self, user_id: uuid.UUID) -> list[dict]:
        stmt = select(OddBet).where(OddBet.user_id == user_id).order_by(OddBet.created_at.desc())
        bets = (await self.session.execute(stmt)).scalars().all()
        out: list[dict] = []
        for b in bets:
            odd = await self.session.get(Odd, b.odd_id)
            out.append(_bet_ctx(b, odd))
        return out


class OddAdminService:
    """Operações do dono: criar, editar, liquidar, cancelar e remover Odds."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_odds(self) -> list[dict]:
        odds = (await self.session.execute(
            select(Odd).order_by(Odd.created_at.desc())
        )).scalars().all()
        out: list[dict] = []
        for o in odds:
            count = await self.session.scalar(
                select(func.count()).select_from(OddBet).where(OddBet.odd_id == o.id)
            ) or 0
            out.append(_odd_dict(o, int(count)))
        return out

    async def get_detail(self, odd_id: uuid.UUID) -> tuple[Odd, list[OddBet], int]:
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        bets = list((await self.session.execute(
            select(OddBet).where(OddBet.odd_id == odd_id).order_by(OddBet.created_at.desc())
        )).scalars().all())
        return odd, bets, len(bets)

    async def create(self, data: dict) -> dict:
        odd = Odd(
            id=uuid.uuid4(),
            title=data["title"],
            type=data.get("type", "vitoria"),
            description=data.get("description"),
            team_a_name=data["team_a_name"],
            team_a_odd=float(data["team_a_odd"]),
            team_b_name=data["team_b_name"],
            team_b_odd=float(data["team_b_odd"]),
            status="open",
        )
        self.session.add(odd)
        await self.session.flush()
        return _odd_dict(odd, 0)

    async def update(self, odd_id: uuid.UUID, data: dict) -> dict:
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        if odd.status != "open":
            raise OddError("Só dá para editar uma aposta aberta.")
        for key in ("title", "description", "team_a_name", "team_b_name"):
            if data.get(key) is not None:
                setattr(odd, key, data[key])
        for key in ("team_a_odd", "team_b_odd"):
            if data.get(key) is not None:
                setattr(odd, key, float(data[key]))
        await self.session.flush()
        return _odd_dict(odd, 0)

    async def settle(self, odd_id: uuid.UUID, winner: str) -> dict:
        """Define o vencedor e paga as apostas vencedoras (ceil do multiplicador)."""
        if winner not in ("a", "b"):
            raise OddError("Vencedor inválido.")
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        if odd.status != "open":
            raise OddError("Esta aposta já foi liquidada ou cancelada.")

        bets = (await self.session.execute(
            select(OddBet).where(OddBet.odd_id == odd_id, OddBet.status == "pending")
        )).scalars().all()
        repo = UserRepository(self.session)
        for b in bets:
            if b.selection == winner:
                payout = payout_for(b.amount, b.odd_value)
                ws = await repo.get_or_create_state(b.user_id)
                if b.currency == "gold":
                    ws.gold += payout
                else:
                    ws.silver += payout
                b.status = "won"
                b.payout = payout
            else:
                b.status = "lost"
                b.payout = 0
            b.settled_at = _now()

        odd.status = "settled"
        odd.winner = winner
        odd.settled_at = _now()
        await self.session.flush()
        return _odd_dict(odd, len(bets))

    async def cancel(self, odd_id: uuid.UUID) -> dict:
        """Cancela a aposta e devolve o valor de todas as apostas pendentes."""
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        if odd.status == "settled":
            raise OddError("Aposta já liquidada — não dá para cancelar.")
        bets = (await self.session.execute(
            select(OddBet).where(OddBet.odd_id == odd_id, OddBet.status == "pending")
        )).scalars().all()
        repo = UserRepository(self.session)
        for b in bets:
            ws = await repo.get_or_create_state(b.user_id)
            if b.currency == "gold":
                ws.gold += b.amount
            else:
                ws.silver += b.amount
            b.status = "refunded"
            b.payout = b.amount
            b.settled_at = _now()
        odd.status = "cancelled"
        odd.settled_at = _now()
        await self.session.flush()
        return _odd_dict(odd, len(bets))

    async def delete(self, odd_id: uuid.UUID) -> None:
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        # Devolve apostas pendentes antes de remover (não confiscar saldo).
        if odd.status == "open":
            await self.cancel(odd_id)
        await self.session.execute(
            OddBet.__table__.delete().where(OddBet.odd_id == odd_id)
        )
        await self.session.delete(odd)
        await self.session.flush()
