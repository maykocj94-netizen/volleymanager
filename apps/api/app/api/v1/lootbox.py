"""Controller: Lootbox (visão do usuário) — listar, ver info e girar."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.repositories.user_repo import UserRepository
from app.schemas.athlete import AthleteOut
from app.schemas.lootbox import LootboxInfoOut, LootboxOut, SpinResult, SpinWon
from app.services.lootbox_service import InsufficientFunds, LootboxError, LootboxService, NotFound

router = APIRouter(prefix="/lootboxes", tags=["lootbox"])


def _state_out(state, club):  # noqa: ANN001, ANN202
    from app.api.v1.me import _to_out
    return _to_out(state, club)


@router.get("", response_model=list[LootboxOut])
async def list_lootboxes(session: DbSession, _user: CurrentUser) -> list[LootboxOut]:
    rows = await LootboxService(session).list_active()
    return [LootboxOut(**r) for r in rows]


@router.get("/{box_id}/info", response_model=LootboxInfoOut)
async def lootbox_info(
    box_id: uuid.UUID, session: DbSession, _user: CurrentUser
) -> LootboxInfoOut:
    try:
        data = await LootboxService(session).info(box_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return LootboxInfoOut(**data)


@router.post("/{box_id}/spin", response_model=SpinResult)
async def spin(box_id: uuid.UUID, session: DbSession, user: CurrentUser) -> SpinResult:
    uid = uuid.UUID(user.id)
    try:
        state, athlete, won = await LootboxService(session).spin(uid, box_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except LootboxError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    club = await UserRepository(session).get_main_club(uid)
    return SpinResult(
        state=_state_out(state, club),
        athlete=AthleteOut.model_validate(athlete),
        won=SpinWon(**won),
    )
