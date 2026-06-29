"""Controller: Desafio Online X1 (presença, convite, sala, partida)."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.schemas.athlete import AthleteOut
from app.schemas.online import (
    ChallengeBrief,
    ChallengeCreate,
    ChallengeOut,
    HeartbeatOut,
    LineupRequest,
    LobbyOut,
    OnlineUserOut,
    RespondRequest,
)
from app.services.online_service import NotFound, OnlineError, OnlineService

router = APIRouter(prefix="/online", tags=["online"])


def _lobby_out(data: dict) -> LobbyOut:
    return LobbyOut(
        challenge=ChallengeOut.model_validate(data["challenge"]),
        challenger_ath=[AthleteOut.model_validate(a) for a in data["challenger_ath"]],
        opponent_ath=[AthleteOut.model_validate(a) for a in data["opponent_ath"]],
        me_is_challenger=data["me_is_challenger"],
    )


@router.post("/heartbeat", response_model=HeartbeatOut)
async def heartbeat(session: DbSession, user: CurrentUser) -> HeartbeatOut:
    data = await OnlineService(session).heartbeat(uuid.UUID(user.id))
    return HeartbeatOut(
        online=[OnlineUserOut(**o) for o in data["online"]],
        incoming=[ChallengeBrief(**c) for c in data["incoming"]],
        outgoing=[ChallengeBrief(**c) for c in data["outgoing"]],
        active_id=data["active_id"],
        active_status=data["active_status"],
    )


@router.post("/challenge", response_model=ChallengeOut)
async def create_challenge(
    body: ChallengeCreate, session: DbSession, user: CurrentUser
) -> ChallengeOut:
    try:
        c = await OnlineService(session).create_challenge(
            uuid.UUID(user.id), body.opponent_id, body.kind, body.sex, body.currency, body.amount
        )
    except OnlineError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ChallengeOut.model_validate(c)


@router.post("/challenge/{cid}/respond", response_model=ChallengeOut)
async def respond(
    cid: uuid.UUID, body: RespondRequest, session: DbSession, user: CurrentUser
) -> ChallengeOut:
    try:
        c = await OnlineService(session).respond(cid, uuid.UUID(user.id), body.accept)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OnlineError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ChallengeOut.model_validate(c)


@router.post("/challenge/{cid}/cancel", response_model=ChallengeOut)
async def cancel(cid: uuid.UUID, session: DbSession, user: CurrentUser) -> ChallengeOut:
    try:
        c = await OnlineService(session).cancel(cid, uuid.UUID(user.id))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ChallengeOut.model_validate(c)


@router.post("/challenge/{cid}/lineup", response_model=LobbyOut)
async def set_lineup(
    cid: uuid.UUID, body: LineupRequest, session: DbSession, user: CurrentUser
) -> LobbyOut:
    svc = OnlineService(session)
    uid = uuid.UUID(user.id)
    try:
        await svc.set_lineup(cid, uid, body.athlete_ids)
        return _lobby_out(await svc.lobby(cid, uid))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OnlineError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/challenge/{cid}/ready", response_model=LobbyOut)
async def ready(cid: uuid.UUID, session: DbSession, user: CurrentUser) -> LobbyOut:
    svc = OnlineService(session)
    uid = uuid.UUID(user.id)
    try:
        await svc.ready(cid, uid)
        return _lobby_out(await svc.lobby(cid, uid))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OnlineError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/challenge/{cid}", response_model=LobbyOut)
async def lobby(cid: uuid.UUID, session: DbSession, user: CurrentUser) -> LobbyOut:
    try:
        return _lobby_out(await OnlineService(session).lobby(cid, uuid.UUID(user.id)))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
