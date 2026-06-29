"""Controller: apostas com Odd (visão do usuário)."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.repositories.user_repo import UserRepository
from app.schemas.odd import OddBetOut, OddOut, PlaceBetRequest, PlaceBetResult
from app.services.odd_service import (
    InsufficientFunds,
    NotFound,
    OddError,
    OddService,
    label_of,
)

router = APIRouter(prefix="/odds", tags=["odds"])


def _state_out(state, club):  # noqa: ANN001, ANN202
    from app.api.v1.me import _to_out
    return _to_out(state, club)


@router.get("", response_model=list[OddOut])
async def list_open_odds(session: DbSession, user: CurrentUser) -> list[OddOut]:
    """Apostas abertas + minhas apostas em cada uma."""
    rows = await OddService(session).list_open(uuid.UUID(user.id))
    return [OddOut(**r) for r in rows]


@router.post("/bet", response_model=PlaceBetResult)
async def place_bet(body: PlaceBetRequest, session: DbSession, user: CurrentUser) -> PlaceBetResult:
    """Aposta um valor (prata/ouro) num lado do confronto."""
    uid = uuid.UUID(user.id)
    try:
        state, bet, odd = await OddService(session).place_bet(
            uid, body.odd_id, body.selection, body.currency, body.amount
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except OddError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    club = await UserRepository(session).get_main_club(uid)
    out = OddBetOut.model_validate(bet)
    out.odd_title = odd.title
    out.odd_type = odd.type
    out.selection_label = label_of(odd, bet.selection)
    out.team_a_name = odd.team_a_name
    out.team_b_name = odd.team_b_name
    out.odd_status = odd.status
    out.odd_winner = odd.winner
    return PlaceBetResult(state=_state_out(state, club), bet=out)


@router.get("/my-bets", response_model=list[OddBetOut])
async def my_bets(session: DbSession, user: CurrentUser) -> list[OddBetOut]:
    rows = await OddService(session).my_bets(uuid.UUID(user.id))
    return [OddBetOut(**r) for r in rows]
