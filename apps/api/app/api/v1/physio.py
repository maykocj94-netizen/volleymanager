"""Controller: Fisioterapia (recuperação de fadiga/lesão)."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.schemas.athlete import AthleteOut
from app.schemas.market import BuyAthleteRequest  # {athlete_id}
from app.services.physio_service import PhysioError, PhysioService
from app.services.user_service import NotFound

router = APIRouter(prefix="/physio", tags=["physio"])


@router.get("", response_model=list[AthleteOut])
async def list_physio(session: DbSession, user: CurrentUser) -> list[AthleteOut]:
    """Atletas fadigados/lesionados ou em recuperação (cura os que já terminaram)."""
    rows = await PhysioService(session).list_for(uuid.UUID(user.id))
    return [AthleteOut.model_validate(a) for a in rows]


@router.post("/start", response_model=AthleteOut)
async def start_physio(
    body: BuyAthleteRequest, session: DbSession, user: CurrentUser
) -> AthleteOut:
    """Coloca um atleta fadigado/lesionado na fisioterapia."""
    uid = uuid.UUID(user.id)
    try:
        athlete = await PhysioService(session).start(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PhysioError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)


@router.post("/cancel", response_model=AthleteOut)
async def cancel_physio(
    body: BuyAthleteRequest, session: DbSession, user: CurrentUser
) -> AthleteOut:
    """Retira um atleta da fisioterapia (continua fadigado/lesionado)."""
    uid = uuid.UUID(user.id)
    try:
        athlete = await PhysioService(session).cancel(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)
