"""Controller: central de contas (admin) — protegida por X-Admin-Token."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import AdminAuth, DbSession
from app.schemas.admin import (
    AdminAddAthlete,
    AdminUser,
    AdminWallet,
    ApproveRequest,
    AthletePatch,
    CoinAdjust,
)
from app.schemas.athlete import AthleteOut
from app.schemas.market import (
    HireListingCreate,
    HireListingOut,
    HireListingUpdate,
    SaleRequestOut,
)
from app.services.admin_service import AdminService
from app.services.sales_service import SalesService
from app.services.user_service import NotFound

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUser])
async def list_users(session: DbSession, _admin: AdminAuth) -> list[AdminUser]:
    rows = await AdminService(session).list_users()
    return [AdminUser(**r) for r in rows]


@router.get("/users/{user_id}/athletes", response_model=list[AthleteOut])
async def user_athletes(
    user_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> list[AthleteOut]:
    athletes = await AdminService(session).list_user_athletes(user_id)
    return [AthleteOut.model_validate(a) for a in athletes]


@router.patch("/athletes/{athlete_id}", response_model=AthleteOut)
async def patch_athlete(
    athlete_id: uuid.UUID, body: AthletePatch, session: DbSession, _admin: AdminAuth
) -> AthleteOut:
    try:
        athlete = await AdminService(session).patch_athlete(
            athlete_id, body.model_dump(exclude_unset=True)
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)


@router.post("/users/{user_id}/athletes", response_model=AthleteOut, status_code=201)
async def add_athlete(
    user_id: uuid.UUID, body: AdminAddAthlete, session: DbSession, _admin: AdminAuth
) -> AthleteOut:
    athlete = await AdminService(session).add_athlete(user_id, body.modality)
    return AthleteOut.model_validate(athlete)


@router.delete("/athletes/{athlete_id}")
async def remove_athlete(
    athlete_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await AdminService(session).remove_athlete(athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/users/{user_id}/coins", response_model=AdminWallet)
async def adjust_coins(
    user_id: uuid.UUID, body: CoinAdjust, session: DbSession, _admin: AdminAuth
) -> AdminWallet:
    state = await AdminService(session).adjust_coins(
        user_id, body.silver_delta, body.gold_delta
    )
    return AdminWallet(user_id=user_id, silver=state.silver, gold=state.gold)


# --- Aprovação de entrada de contas ---------------------------------------
@router.post("/users/{user_id}/approve", response_model=AdminUser)
async def approve_user(
    user_id: uuid.UUID, body: ApproveRequest, session: DbSession, _admin: AdminAuth
) -> AdminUser:
    await AdminService(session).set_approved(user_id, body.approved)
    rows = await AdminService(session).list_users()
    row = next((r for r in rows if str(r["user_id"]) == str(user_id)), None)
    if row is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return AdminUser(**row)


# --- Vendas (aprovação do dono) -------------------------------------------
@router.get("/sales", response_model=list[SaleRequestOut])
async def list_sales(session: DbSession, _admin: AdminAuth) -> list[SaleRequestOut]:
    rows = await SalesService(session).list_pending()
    return [SaleRequestOut(**r) for r in rows]


@router.post("/sales/{request_id}/approve", response_model=dict)
async def approve_sale(
    request_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict:
    try:
        await SalesService(session).approve(request_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/sales/{request_id}/reject", response_model=dict)
async def reject_sale(
    request_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict:
    try:
        await SalesService(session).reject(request_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


# --- Anúncios de contratação (criação personalizada — só admin) -----------
@router.get("/listings", response_model=list[HireListingOut])
async def list_listings(session: DbSession, _admin: AdminAuth) -> list[HireListingOut]:
    listings = await AdminService(session).list_listings()
    return [HireListingOut.model_validate(li) for li in listings]


@router.post("/listings", response_model=HireListingOut, status_code=201)
async def create_listing(
    body: HireListingCreate, session: DbSession, _admin: AdminAuth
) -> HireListingOut:
    data = body.model_dump(mode="json")
    data["attributes"] = body.attributes.model_dump()
    listing = await AdminService(session).create_listing(data)
    return HireListingOut.model_validate(listing)


@router.patch("/listings/{listing_id}", response_model=HireListingOut)
async def update_listing(
    listing_id: uuid.UUID, body: HireListingUpdate, session: DbSession, _admin: AdminAuth
) -> HireListingOut:
    data = body.model_dump(exclude_unset=True)
    if body.attributes is not None:
        data["attributes"] = body.attributes.model_dump()
    try:
        listing = await AdminService(session).update_listing(listing_id, data)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return HireListingOut.model_validate(listing)


@router.post("/listings/{listing_id}/republish", response_model=HireListingOut)
async def republish_listing(
    listing_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> HireListingOut:
    try:
        listing = await AdminService(session).republish_listing(listing_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return HireListingOut.model_validate(listing)


@router.delete("/listings/{listing_id}")
async def delete_listing(
    listing_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await AdminService(session).delete_listing(listing_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}
