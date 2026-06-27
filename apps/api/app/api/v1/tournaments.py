"""Controller: Competições (visão do usuário)."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.schemas.tournament import (
    RegisterRequest,
    TournamentDetailOut,
    TournamentEntryOut,
    TournamentMatchOut,
    TournamentOut,
)
from app.services.onboarding import ensure_player_setup
from app.services.tournament_service import NotFound, TournamentError, TournamentService

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


async def _detail(svc: TournamentService, tid: uuid.UUID, user_id: uuid.UUID) -> TournamentDetailOut:
    t = await svc.get(tid)
    entries = await svc.get_entries(tid)
    matches = await svc.get_matches(tid)
    mine = await svc.my_entry(user_id, tid)
    return TournamentDetailOut(
        tournament=TournamentOut(**svc._tour_dict(t, len(entries))),
        entries=[TournamentEntryOut.model_validate(e) for e in entries],
        matches=[TournamentMatchOut.model_validate(m) for m in matches],
        my_entry_id=mine.id if mine else None,
    )


@router.get("", response_model=list[TournamentOut])
async def list_tournaments(session: DbSession, _user: CurrentUser) -> list[TournamentOut]:
    rows = await TournamentService(session).list_for_users()
    return [TournamentOut(**r) for r in rows]


@router.get("/{tid}", response_model=TournamentDetailOut)
async def tournament_detail(
    tid: uuid.UUID, session: DbSession, user: CurrentUser
) -> TournamentDetailOut:
    try:
        return await _detail(TournamentService(session), tid, uuid.UUID(user.id))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{tid}/register", response_model=TournamentDetailOut)
async def register(
    tid: uuid.UUID, body: RegisterRequest, session: DbSession, user: CurrentUser
) -> TournamentDetailOut:
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    svc = TournamentService(session)
    try:
        await svc.register(uid, tid, body.athlete_ids)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TournamentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return await _detail(svc, tid, uid)
