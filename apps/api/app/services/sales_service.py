"""Vendas com aprovação do dono.

O jogador anuncia um atleta (não vende na hora): cria um pedido pendente. O dono
aprova (credita a prata ao vendedor e remove o atleta) ou recusa (libera o atleta).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import Athlete
from app.models.sale_request import SaleRequest
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.user_service import NotFound


class SalesService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # -- jogador ----------------------------------------------------------
    async def list_for_sale(
        self, user_id: uuid.UUID, athlete_id: uuid.UUID
    ) -> SaleRequest:
        repo = UserRepository(self.session)
        club = await repo.get_main_club(user_id)
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or club is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        # Reaproveita pedido pendente, se já houver.
        existing = (
            await self.session.execute(
                select(SaleRequest).where(
                    SaleRequest.athlete_id == athlete_id, SaleRequest.status == "pending"
                )
            )
        ).scalars().first()
        if existing is not None:
            return existing
        price = athlete.sale_value
        req = SaleRequest(
            id=uuid.uuid4(), athlete_id=athlete_id, seller_id=user_id,
            price=price, status="pending",
        )
        athlete.for_sale = True
        athlete.sale_listed_price = price
        self.session.add(req)
        await self.session.flush()
        return req

    async def cancel(self, user_id: uuid.UUID, request_id: uuid.UUID) -> None:
        req = await self.session.get(SaleRequest, request_id)
        if req is None or req.seller_id != user_id or req.status != "pending":
            raise NotFound("Pedido de venda não encontrado.")
        req.status = "rejected"
        req.resolved_at = datetime.now(timezone.utc)
        athlete = await AthleteRepository(self.session).get(req.athlete_id)
        if athlete is not None:
            athlete.for_sale = False

    # -- dono (admin) -----------------------------------------------------
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
