"""Mercado de transferências entre jogadores (P2P, em ouro).

O jogador coloca um atleta à venda; ele aparece no mercado para os OUTROS
usuários, que podem comprá-lo direto. Ao comprar, o ouro sai do comprador, vai
para o vendedor, e o atleta é transferido para o clube do comprador.

(As funções de aprovação do dono — list_pending/approve/reject — continuam para
compatibilidade com pedidos antigos; o fluxo novo é direto entre jogadores.)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import Athlete
from app.models.club import Club
from app.models.sale_request import SaleRequest
from app.models.user_state import UserState
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.user_service import InsufficientFunds, NotFound

# 1 ouro = 10 prata (mesma cotação do câmbio). Preço do atleta em ouro.
GOLD_PRICE_DIVISOR = 10


class SaleError(Exception):
    """Erro de regra do mercado (ex.: comprar o próprio atleta)."""


def gold_price(sale_value: int) -> int:
    return max(1, round((sale_value or 0) / GOLD_PRICE_DIVISOR))


class SalesService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # -- jogador: mercado P2P em ouro -------------------------------------
    async def list_for_sale(self, user_id: uuid.UUID, athlete_id: uuid.UUID) -> Athlete:
        """Coloca um atleta do elenco à venda (preço em ouro = valor / 10)."""
        club = await UserRepository(self.session).get_main_club(user_id)
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or club is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        if athlete.listing_id is not None:
            raise NotFound("Atletas de contratação (anúncio) não podem ser vendidos.")
        athlete.for_sale = True
        athlete.sale_listed_price = gold_price(athlete.sale_value)
        await self.session.flush()
        return athlete

    async def unlist(self, user_id: uuid.UUID, athlete_id: uuid.UUID) -> Athlete:
        """Retira um atleta da venda."""
        club = await UserRepository(self.session).get_main_club(user_id)
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or club is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        athlete.for_sale = False
        athlete.sale_listed_price = None
        await self.session.flush()
        return athlete

    async def list_market(self, user_id: uuid.UUID) -> list[dict]:
        """Atletas à venda de OUTROS usuários (compráveis por ouro)."""
        my_club = await UserRepository(self.session).get_main_club(user_id)
        my_club_id = my_club.id if my_club else None
        rows = (
            await self.session.execute(select(Athlete).where(Athlete.for_sale.is_(True)))
        ).unique().scalars().all()
        out: list[dict] = []
        for a in rows:
            if a.club_id is None or a.club_id == my_club_id:
                continue
            club = await self.session.get(Club, a.club_id)
            if club is None or club.is_cpu or club.owner_id is None:
                continue
            out.append({
                "athlete": a,
                "seller_id": club.owner_id,
                "seller_name": club.name,
                "price_gold": a.sale_listed_price or gold_price(a.sale_value),
            })
        return out

    async def buy_athlete(
        self, buyer_id: uuid.UUID, athlete_id: uuid.UUID
    ) -> tuple[UserState, Athlete]:
        repo = UserRepository(self.session)
        buyer_club = await repo.get_main_club(buyer_id)
        if buyer_club is None:
            raise NotFound("Você não tem um clube.")
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or not athlete.for_sale or athlete.club_id is None:
            raise NotFound("Atleta não está mais à venda.")
        seller_club = await self.session.get(Club, athlete.club_id)
        if seller_club is None or seller_club.owner_id is None:
            raise NotFound("Vendedor não encontrado.")
        if seller_club.id == buyer_club.id:
            raise SaleError("Você não pode comprar o próprio atleta.")

        price = athlete.sale_listed_price or gold_price(athlete.sale_value)
        buyer_state = await repo.get_or_create_state(buyer_id)
        if buyer_state.gold < price:
            raise InsufficientFunds(
                f"Precisa de {price} de ouro para comprar (tem {buyer_state.gold})."
            )
        # Paga: ouro sai do comprador e vai para o vendedor.
        buyer_state.gold -= price
        seller_state = await repo.get_or_create_state(seller_club.owner_id)
        seller_state.gold += price
        # Transfere o atleta para o clube do comprador.
        athlete.club_id = buyer_club.id
        athlete.for_sale = False
        athlete.sale_listed_price = None
        await self.session.flush()
        return buyer_state, athlete

    # -- dono (admin) — pedidos antigos (compatibilidade) -----------------
    async def list_pending(self) -> list[dict]:
        rows = (
            await self.session.execute(
                select(SaleRequest).where(SaleRequest.status == "pending")
                .order_by(SaleRequest.created_at.desc())
            )
        ).scalars().all()
        out: list[dict] = []
        for r in rows:
            athlete = await AthleteRepository(self.session).get(r.athlete_id)
            out.append({
                "id": r.id,
                "athlete_id": r.athlete_id,
                "seller_id": r.seller_id,
                "price": r.price,
                "status": r.status,
                "athlete_name": (
                    f"{athlete.first_name} {athlete.last_name}" if athlete else "—"
                ),
                "current_ability": athlete.current_ability if athlete else 0,
            })
        return out

    async def approve(self, request_id: uuid.UUID) -> SaleRequest:
        req = await self.session.get(SaleRequest, request_id)
        if req is None or req.status != "pending":
            raise NotFound("Pedido de venda não encontrado.")
        athlete = await AthleteRepository(self.session).get(req.athlete_id)
        state = await UserRepository(self.session).get_or_create_state(req.seller_id)
        if athlete is not None:
            state.silver += req.price
            await self.session.delete(athlete)
        req.status = "approved"
        req.resolved_at = datetime.now(timezone.utc)
        return req

    async def reject(self, request_id: uuid.UUID) -> SaleRequest:
        req = await self.session.get(SaleRequest, request_id)
        if req is None or req.status != "pending":
            raise NotFound("Pedido de venda não encontrado.")
        athlete = await AthleteRepository(self.session).get(req.athlete_id)
        if athlete is not None:
            athlete.for_sale = False
        req.status = "rejected"
        req.resolved_at = datetime.now(timezone.utc)
        return req
