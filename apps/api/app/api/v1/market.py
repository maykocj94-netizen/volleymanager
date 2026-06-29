"""Controller: mercado do jogador — contratações (anúncios) e vendas."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.repositories.user_repo import UserRepository
from app.schemas.athlete import AthleteOut
from app.schemas.market import (
    AthleteSaleResult,
    BuyAthleteRequest,
    HireListingOut,
    HireListingRequest,
    HireListingResult,
    ListForSaleRequest,
    MarketSaleOut,
)
from app.schemas.user import UserStateOut
from app.services.market_service import MarketplaceService, expire_due
from app.services.sales_service import SaleError, SalesService
from app.services.user_service import InsufficientFunds, NotFound

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


@router.post("/list-for-sale", response_model=AthleteOut)
async def list_for_sale(
    body: ListForSaleRequest, session: DbSession, user: CurrentUser
) -> AthleteOut:
    """Coloca um atleta à venda no mercado (compra direta por outros, em ouro)."""
    uid = uuid.UUID(user.id)
    try:
        athlete = await SalesService(session).list_for_sale(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)


@router.post("/unlist", response_model=AthleteOut)
async def unlist(
    body: BuyAthleteRequest, session: DbSession, user: CurrentUser
) -> AthleteOut:
    """Retira um atleta da venda."""
    uid = uuid.UUID(user.id)
    try:
        athlete = await SalesService(session).unlist(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)


@router.get("/for-sale", response_model=list[MarketSaleOut])
async def for_sale(session: DbSession, user: CurrentUser) -> list[MarketSaleOut]:
    """Atletas à venda por outros usuários (compra direta com ouro)."""
    rows = await SalesService(session).list_market(uuid.UUID(user.id))
    return [
        MarketSaleOut(
            athlete=AthleteOut.model_validate(r["athlete"]),
            seller_id=r["seller_id"],
            seller_name=r["seller_name"],
            price_gold=r["price_gold"],
        )
        for r in rows
    ]


@router.post("/buy-athlete", response_model=AthleteSaleResult)
async def buy_athlete(
    body: BuyAthleteRequest, session: DbSession, user: CurrentUser
) -> AthleteSaleResult:
    """Compra um atleta à venda. O ouro vai direto para o vendedor."""
    uid = uuid.UUID(user.id)
    try:
        state, athlete = await SalesService(session).buy_athlete(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except SaleError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    club = await UserRepository(session).get_main_club(uid)
    return AthleteSaleResult(
        state=_state_out(state, club),
        athlete=AthleteOut.model_validate(athlete),
    )


# Expiração preguiçosa também é disparada aqui (além do /me).
@router.post("/sync", response_model=dict)
async def sync_expiry(session: DbSession, user: CurrentUser) -> dict:
    uid = uuid.UUID(user.id)
    club = await UserRepository(session).get_main_club(uid)
    n = await expire_due(session, club_id=club.id if club else None)
    return {"expired": n}
