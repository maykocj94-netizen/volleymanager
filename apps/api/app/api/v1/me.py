"""Controller: estado do jogador (carteira, login diário, escalação, contratação)."""

import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.engine.cpu import cpu_names, difficulty_label
from app.engine.match_engine import MatchResult
from app.enums import Sex
from app.models.user_state import LOGIN_STREAK_BONUS, SCENARIO_REROLL_COST, UserState
from app.repositories.user_repo import UserRepository
from app.schemas.athlete import AthleteOut
from app.schemas.match import MatchEventOut, MatchResultOut, SetScoreOut
from app.schemas.user import (
    AthleteIdRequest,
    CpuInfoOut,
    HireRequest,
    HireResult,
    Lineup,
    LoginResult,
    MatchResultReport,
    MatchStartRequest,
    MatchStartResult,
    ScenarioOut,
    SellResult,
    SignResult,
    UserStateOut,
)
from app.services.onboarding import ensure_player_setup
from app.services.play_service import PlayService
from app.services.user_service import InsufficientFunds, NotFound, UserService

router = APIRouter(prefix="/me", tags=["me"])


def _result_out(result: MatchResult) -> MatchResultOut:
    return MatchResultOut(
        home_sets=result.home_sets,
        away_sets=result.away_sets,
        winner=result.winner,
        sets=[SetScoreOut(set_no=s.set_no, home=s.home, away=s.away) for s in result.sets],
        events=[
            MatchEventOut(
                set_no=e.set_no, rally_no=e.rally_no, event_type=e.event_type,
                side=e.side, text=e.text, athlete=e.athlete,
            )
            for e in result.events
        ],
    )


def _to_out(state: UserState, club_id: uuid.UUID | None) -> UserStateOut:
    lineup = state.lineup or {}
    return UserStateOut(
        silver=state.silver,
        gold=state.gold,
        streak=state.streak,
        last_login=state.last_login,
        matches_played=state.matches_played,
        matches_won=state.matches_won,
        matches_lost=state.matches_lost,
        lineup=Lineup(
            beach_m=lineup.get("beach_m", []),
            beach_f=lineup.get("beach_f", []),
            indoor_m=lineup.get("indoor_m", []),
            indoor_f=lineup.get("indoor_f", []),
        ),
        club_id=club_id,
    )


async def _club_id(session, user_id: uuid.UUID) -> uuid.UUID | None:  # noqa: ANN001
    club = await UserRepository(session).get_main_club(user_id)
    return club.id if club else None


@router.get("", response_model=UserStateOut)
async def get_me(session: DbSession, user: CurrentUser) -> UserStateOut:
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    service = UserService(session)
    state = await service.get_state(uid)
    return _to_out(state, await _club_id(session, uid))


@router.post("/login", response_model=LoginResult)
async def daily_login(session: DbSession, user: CurrentUser) -> LoginResult:
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    state, bonus = await UserService(session).daily_login(uid)
    return LoginResult(
        state=_to_out(state, await _club_id(session, uid)),
        bonus_awarded=bonus,
        bonus_amount=LOGIN_STREAK_BONUS if bonus else 0,
    )


@router.post("/dev/next-day", response_model=LoginResult)
async def dev_next_day(session: DbSession, user: CurrentUser) -> LoginResult:
    """DEV: simula um login de dia consecutivo (testa o bônus de 7 dias)."""
    if not settings.is_dev:
        raise HTTPException(status_code=403, detail="Disponível apenas em desenvolvimento")
    uid = uuid.UUID(user.id)
    state, bonus = await UserService(session).simulate_next_day(uid)
    return LoginResult(
        state=_to_out(state, await _club_id(session, uid)),
        bonus_awarded=bonus,
        bonus_amount=LOGIN_STREAK_BONUS if bonus else 0,
    )


@router.put("/lineup", response_model=UserStateOut)
async def save_lineup(body: Lineup, session: DbSession, user: CurrentUser) -> UserStateOut:
    uid = uuid.UUID(user.id)
    state = await UserService(session).set_lineup(uid, body.model_dump(mode="json"))
    return _to_out(state, await _club_id(session, uid))


@router.post("/hire", response_model=HireResult)
async def hire(body: HireRequest, session: DbSession, user: CurrentUser) -> HireResult:
    uid = uuid.UUID(user.id)
    try:
        athlete, state = await UserService(session).hire(uid, body.modality)
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    return HireResult(
        athlete=AthleteOut.model_validate(athlete),
        state=_to_out(state, await _club_id(session, uid)),
    )


@router.post("/match-result", response_model=UserStateOut)
async def report_match_result(
    body: MatchResultReport, session: DbSession, user: CurrentUser
) -> UserStateOut:
    """Registra o resultado de uma partida (atualiza stats e desempenho dos atletas)."""
    uid = uuid.UUID(user.id)
    state = await UserService(session).record_match_result(uid, body.won, body.athlete_ids)
    return _to_out(state, await _club_id(session, uid))


@router.post("/sell", response_model=SellResult)
async def sell_athlete(
    body: AthleteIdRequest, session: DbSession, user: CurrentUser
) -> SellResult:
    """Vende um atleta do elenco; credita prata pelo valor de venda (por desempenho)."""
    uid = uuid.UUID(user.id)
    try:
        value, state = await UserService(session).sell_athlete(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SellResult(value=value, state=_to_out(state, await _club_id(session, uid)))


@router.get("/scenario", response_model=ScenarioOut)
async def get_scenario(
    session: DbSession,
    user: CurrentUser,
    kind: Literal["beach", "indoor"] = Query("beach"),
    sex: Sex = Query(Sex.MALE),
) -> ScenarioOut:
    """Cenário atual da partida (estável até trocar). Inclui os nomes da CPU
    para a categoria escolhida (dupla de praia ou sexteto de quadra)."""
    svc = PlayService(session)
    state, scenario = await svc.get_scenario(uuid.UUID(user.id))
    count = 2 if kind == "beach" else 6
    return ScenarioOut(
        tier=scenario["tier"],
        label=difficulty_label(scenario["tier"]),
        tactic=scenario["tactic"],
        weather=scenario["weather"],
        cpu_names=cpu_names(scenario["name_seed"], sex, count),
        free_rerolls_left=svc.free_rerolls_left(state),
        reroll_cost=SCENARIO_REROLL_COST,
    )


@router.post("/scenario/reroll", response_model=ScenarioOut)
async def reroll_scenario(
    session: DbSession,
    user: CurrentUser,
    kind: Literal["beach", "indoor"] = Query("beach"),
    sex: Sex = Query(Sex.MALE),
) -> ScenarioOut:
    """Troca o cenário (dificuldade/clima/adversário). 3 grátis por semana;
    depois custa prata."""
    svc = PlayService(session)
    try:
        state, scenario = await svc.reroll(uuid.UUID(user.id))
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    count = 2 if kind == "beach" else 6
    return ScenarioOut(
        tier=scenario["tier"],
        label=difficulty_label(scenario["tier"]),
        tactic=scenario["tactic"],
        weather=scenario["weather"],
        cpu_names=cpu_names(scenario["name_seed"], sex, count),
        free_rerolls_left=svc.free_rerolls_left(state),
        reroll_cost=SCENARIO_REROLL_COST,
    )


@router.post("/match/start", response_model=MatchStartResult)
async def start_match(
    body: MatchStartRequest, session: DbSession, user: CurrentUser
) -> MatchStartResult:
    """Inicia uma partida contra a CPU usando o cenário salvo. O servidor monta
    os times, simula e já registra o resultado (autoritativo)."""
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    state, result, cpu, _ids = await PlayService(session).start_match(
        uid, body.kind, body.sex, body.home_tactic
    )
    return MatchStartResult(
        result=_result_out(result),
        cpu=CpuInfoOut(**cpu),
        state=_to_out(state, await _club_id(session, uid)),
    )


@router.post("/sign-custom", response_model=SignResult)
async def sign_custom(
    body: AthleteIdRequest, session: DbSession, user: CurrentUser
) -> SignResult:
    """Contrata um atleta personalizado (Mercado → Contratações)."""
    uid = uuid.UUID(user.id)
    try:
        athlete, state = await UserService(session).sign_custom(uid, body.athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    return SignResult(
        athlete=AthleteOut.model_validate(athlete),
        state=_to_out(state, await _club_id(session, uid)),
    )
