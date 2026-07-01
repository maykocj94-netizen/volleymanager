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


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _betting_open(o: Odd) -> bool:
    """Aceita apostas? Aberta e ainda dentro do prazo (se houver)."""
    if o.status != "open":
        return False
    return o.closes_at is None or _aware(o.closes_at) > _now()


def payout_for(amount: int, odd_value: float) -> int:
    """Pagamento da aposta vencedora: ceil(valor × multiplicador)."""
    return int(math.ceil(amount * float(odd_value)))


def options_of(o: Odd) -> list[dict]:
    """Opções da aposta, unificadas: vitória (A/B) e placar (alternativas)."""
    if o.type == "placar":
        return [dict(opt) for opt in (o.options or [])]
    return [
        {"key": "a", "label": o.team_a_name, "odd": o.team_a_odd},
        {"key": "b", "label": o.team_b_name, "odd": o.team_b_odd},
    ]


def _option_map(o: Odd) -> dict[str, dict]:
    return {opt["key"]: opt for opt in options_of(o)}


def label_of(o: Odd, key: str | None) -> str:
    if key is None:
        return ""
    opt = _option_map(o).get(key)
    return opt["label"] if opt else key


def _odd_dict(o: Odd, bet_count: int = 0) -> dict:
    return {
        "id": o.id, "title": o.title, "type": o.type, "description": o.description,
        "team_a_name": o.team_a_name, "team_a_odd": o.team_a_odd,
        "team_b_name": o.team_b_name, "team_b_odd": o.team_b_odd,
        "options": options_of(o),
        "status": o.status, "winner": o.winner, "bet_count": bet_count,
        "closes_at": o.closes_at, "betting_open": _betting_open(o),
    }


def _bet_ctx(b: OddBet, o: Odd | None) -> dict:
    return {
        "id": b.id, "odd_id": b.odd_id, "selection": b.selection,
        "selection_label": label_of(o, b.selection) if o else b.selection,
        "currency": b.currency, "amount": b.amount, "odd_value": b.odd_value,
        "status": b.status, "payout": b.payout,
        "odd_title": o.title if o else "",
        "odd_type": o.type if o else "",
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
        if amount <= 0:
            raise OddError("Informe um valor de aposta válido.")
        odd = await self.session.get(Odd, odd_id)
        if odd is None or odd.status != "open":
            raise NotFound("Aposta indisponível (fechada ou removida).")
        if odd.closes_at is not None and _now() >= _aware(odd.closes_at):
            raise OddError("As apostas para este confronto já foram encerradas.")

        option = _option_map(odd).get(selection)
        if option is None:
            raise OddError("Opção inválida.")

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

        odd_value = option["odd"]
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

    @staticmethod
    def _build_options(multiplier: float, alternatives: list) -> list[dict]:
        if multiplier < 1.0:
            raise OddError("Informe um multiplicador válido (>= 1).")
        alts = [str(a).strip() for a in (alternatives or []) if str(a).strip()]
        if len(alts) < 2:
            raise OddError("Adicione pelo menos 2 alternativas.")
        return [{"key": f"opt{i}", "label": a, "odd": float(multiplier)} for i, a in enumerate(alts)]

    async def create(self, data: dict) -> dict:
        otype = data.get("type", "vitoria")
        odd = Odd(
            id=uuid.uuid4(),
            title=data["title"],
            type=otype,
            description=data.get("description"),
            closes_at=data.get("closes_at"),
            status="open",
        )
        if otype == "placar":
            odd.options = self._build_options(
                float(data.get("multiplier") or 0), data.get("alternatives") or []
            )
        else:
            if not data.get("team_a_name") or not data.get("team_b_name"):
                raise OddError("Informe os dois times do confronto.")
            odd.team_a_name = data["team_a_name"]
            odd.team_a_odd = float(data["team_a_odd"])
            odd.team_b_name = data["team_b_name"]
            odd.team_b_odd = float(data["team_b_odd"])
        self.session.add(odd)
        await self.session.flush()
        return _odd_dict(odd, 0)

    async def update(self, odd_id: uuid.UUID, data: dict) -> dict:
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        if odd.status != "open":
            raise OddError("Só dá para editar uma aposta aberta.")
        for key in ("title", "description"):
            if data.get(key) is not None:
                setattr(odd, key, data[key])
        # closes_at: presença da chave (mesmo None) permite limpar/definir o prazo.
        if "closes_at" in data:
            odd.closes_at = data["closes_at"]
        if odd.type == "placar":
            if data.get("multiplier") is not None or data.get("alternatives") is not None:
                mult = float(
                    data.get("multiplier")
                    if data.get("multiplier") is not None
                    else (odd.options[0]["odd"] if odd.options else 2.0)
                )
                alts = data.get("alternatives")
                if alts is None:
                    alts = [o["label"] for o in (odd.options or [])]
                odd.options = self._build_options(mult, alts)
        else:
            for key in ("team_a_name", "team_b_name"):
                if data.get(key) is not None:
                    setattr(odd, key, data[key])
            for key in ("team_a_odd", "team_b_odd"):
                if data.get(key) is not None:
                    setattr(odd, key, float(data[key]))
        await self.session.flush()
        return _odd_dict(odd, 0)

    async def settle(self, odd_id: uuid.UUID, winner: str) -> dict:
        """Define o vencedor e paga as apostas vencedoras (ceil do multiplicador)."""
        odd = await self.session.get(Odd, odd_id)
        if odd is None:
            raise NotFound("Aposta não encontrada.")
        if odd.status != "open":
            raise OddError("Esta aposta já foi liquidada ou cancelada.")
        if winner not in _option_map(odd):
            raise OddError("Opção vencedora inválida.")

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
