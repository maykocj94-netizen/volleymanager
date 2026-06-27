"""Controller: mercado do jogador — contratações (anúncios) e vendas."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.repositories.user_repo import UserRepository
from app.schemas.athlete import AthleteOut
from app.schemas.market import (
    HireListingOut,
    HireListingRequest,
    HireListingResult,
    ListForSaleRequest,
    SaleRequestOut,
)
from app.schemas.user import UserStateOut
from app.services.market_service import MarketplaceService, expire_due
from app.services.sales_service import SalesService
from app.services.user_service import InsufficientFunds, NotFound, UserService

router = APIRouter(prefix="/market", tags=["market"])


def _state_out(state, club) -> UserStateOut:  # noqa: ANN001
    from app.api.v1.me import _to_out
    return _to_out(state, club)


@router.get("/listings", response_model=list[HireListingOut])
async def list_listings(session: DbSession, _user: CurrentUser) -> list[HireListingOut]:
    """Anúncios de contratação publicados pelo dono (disponíveis para todos)."""
    listings = await MarketplaceService(session).list_published()
    return [HireListingOut.model_validate(li) for li in listings]


@router.post("/hire", response_model=HireListingResult)
async def hire_listing(
    body: HireListingRequest, session: DbSession, user: CurrentUser
) -> HireListingResult:
    """Contrata um atleta anunciado. Único: some para os demais ao contratar."""
    uid = uuid.UUID(user.id)
    try:
        athlete, state = await MarketplaceService(session).hire(
            uid, body.listing_id, body.currency
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    club = await UserRepository(session).get_main_club(uid)
    return HireListingResult(
        athlete=AthleteOut.model_validate(athlete),
        state=_state_out(state, club),
    )


@router.post("/list-for-sale", response_model=SaleRequestOut)
async def list_for_sale(
    body: ListForSaleRequest, session: DbSession, user: CurrentUser
) -> SaleRequestOut:
    """Anuncia um atleta para venda (vai para aprovação do dono)."""
    uid = uuid.UUID(user.id)
    try:
        req = await SalesService(session).list_for_sale(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SaleRequestOut(
        id=req.id, athlete_id=req.athlete_id, seller_id=req.seller_id,
        price=req.price, status=req.status,
    )


@router.post("/cancel-sale/{request_id}", response_model=UserStateOut)
async def cancel_sale(
    request_id: uuid.UUID, session: DbSession, user: CurrentUser
) -> UserStateOut:
    uid = uuid.UUID(user.id)
    try:
        await SalesService(session).cancel(uid, request_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    state = await UserService(session).get_state(uid)
    club = await UserRepository(session).get_main_club(uid)
    return _state_out(state, club)


@router.get("/my-sales", response_model=list[SaleRequestOut])
async def my_sales(session: DbSession, user: CurrentUser) -> list[SaleRequestOut]:
    """Pedidos de venda pendentes do jogador."""
    from sqlalchemy import select

    from app.models.sale_request import SaleRequest
    uid = uuid.UUID(user.id)
    rows = (
        await session.execute(
            select(SaleRequest).where(
                SaleRequest.seller_id == uid, SaleRequest.status == "pending"
            )
        )
    ).scalars().all()
    return [
        SaleRequestOut(
            id=r.id, athlete_id=r.athlete_id, seller_id=r.seller_id,
            price=r.price, status=r.status,
        )
        for r in rows
    ]


# Expiração preguiçosa também é disparada aqui (além do /me).
@router.post("/sync", response_model=dict)
async def sync_expiry(session: DbSession, user: CurrentUser) -> dict:
    uid = uuid.UUID(user.id)
    club = await UserRepository(session).get_main_club(uid)
    n = await expire_due(session, club_id=club.id if club else None)
    return {"expired": n}
