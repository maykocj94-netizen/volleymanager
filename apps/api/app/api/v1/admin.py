"""Controller: central de contas (admin) — protegida por X-Admin-Token."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import AdminAuth, DbSession
from app.schemas.admin import (
    AdminAddAthlete,
    AdminUser,
    AdminWallet,
    AthletePatch,
    CoinAdjust,
)
from app.schemas.athlete import AthleteOut
from app.services.admin_service import AdminService
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
