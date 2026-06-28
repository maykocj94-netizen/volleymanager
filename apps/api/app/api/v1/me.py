"""Controller: estado do jogador (carteira, login diário, escalação, contratação)."""

import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.engine.cpu import cpu_names, cpu_team_name, difficulty_label
from app.engine.match_engine import MatchResult
from app.enums import Sex
from app.models.user_state import LOGIN_STREAK_BONUS, SCENARIO_REROLL_COST, UserState
from app.repositories.user_repo import UserRepository
from app.schemas.athlete import AthleteOut
from app.schemas.match import MatchEventOut, MatchResultOut, SetScoreOut
from app.schemas.user import (
    AthleteIdRequest,
    ClubUpdate,
    CpuInfoOut,
    HireRequest,
    HireResult,
    Lineup,
    LoginResult,
    MatchFinishResult,
    MatchResultReport,
    MatchSimRequest,
    MatchSimResult,
    ScenarioOut,
    SellResult,
    SignResult,
    TrainRequest,
    TrainResult,
    UserStateOut,
)
from app.services.onboarding import ensure_player_setup
from app.services.play_service import NotEnoughAthletes, PlayService, TimeoutLimitError
from app.services.training_service import TrainingError, TrainingService
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


def _to_out(state: UserState, club) -> UserStateOut:  # noqa: ANN001  (club: Club | None)
    lineup = state.lineup or {}
    return UserStateOut(
        silver=state.silver,
        gold=state.gold,
        streak=state.streak,
        last_login=state.last_login,
        matches_played=state.matches_played,
        matches_won=state.matches_won,
        matches_lost=state.matches_lost,
        online_wins=state.online_wins,
        online_losses=state.online_losses,
        approved=bool(state.approved),
        lineup=Lineup(
            beach_m=lineup.get("beach_m", []),
            beach_f=lineup.get("beach_f", []),
            indoor_m=lineup.get("indoor_m", []),
            indoor_f=lineup.get("indoor_f", []),
        ),
        club_id=club.id if club else None,
        club_name=club.name if club else None,
        club_city=club.city if club else None,
    )


async def _club(session, user_id: uuid.UUID):  # noqa: ANN001, ANN201
    return await UserRepository(session).get_main_club(user_id)


@router.get("", response_model=UserStateOut)
async def get_me(session: DbSession, user: CurrentUser) -> UserStateOut:
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    service = UserService(session)
    state = await service.get_state(uid)
    # Captura o e-mail de login (do JWT) para exibir na central de contas.
    if user.email and state.email != user.email:
        state.email = user.email
    return _to_out(state, await _club(session, uid))


@router.post("/login", response_model=LoginResult)
async def daily_login(session: DbSession, user: CurrentUser) -> LoginResult:
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    state, bonus = await UserService(session).daily_login(uid)
    return LoginResult(
        state=_to_out(state, await _club(session, uid)),
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
        state=_to_out(state, await _club(session, uid)),
        bonus_awarded=bonus,
        bonus_amount=LOGIN_STREAK_BONUS if bonus else 0,
    )


@router.patch("/club", response_model=UserStateOut)
async def update_club(body: ClubUpdate, session: DbSession, user: CurrentUser) -> UserStateOut:
    """Personaliza a conta: nome do clube e cidade."""
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    club = await _club(session, uid)
    if club is None:
        raise HTTPException(status_code=404, detail="Clube não encontrado.")
    if body.name is not None and body.name.strip():
        club.name = body.name.strip()
    if body.city is not None:
        club.city = body.city.strip() or None
    state = await UserService(session).get_state(uid)
    return _to_out(state, club)


@router.put("/lineup", response_model=UserStateOut)
async def save_lineup(body: Lineup, session: DbSession, user: CurrentUser) -> UserStateOut:
    uid = uuid.UUID(user.id)
    state = await UserService(session).set_lineup(uid, body.model_dump(mode="json"))
    return _to_out(state, await _club(session, uid))


@router.post("/hire", response_model=HireResult)
async def hire(body: HireRequest, session: DbSession, user: CurrentUser) -> HireResult:
    uid = uuid.UUID(user.id)
    try:
        athlete, state = await UserService(session).hire(uid, body.modality)
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    return HireResult(
        athlete=AthleteOut.model_validate(athlete),
        state=_to_out(state, await _club(session, uid)),
    )


@router.post("/match-result", response_model=UserStateOut)
async def report_match_result(
    body: MatchResultReport, session: DbSession, user: CurrentUser
) -> UserStateOut:
    """Registra o resultado de uma partida (atualiza stats e desempenho dos atletas)."""
    uid = uuid.UUID(user.id)
    state = await UserService(session).record_match_result(uid, body.won, body.athlete_ids)
    return _to_out(state, await _club(session, uid))


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
    return SellResult(value=value, state=_to_out(state, await _club(session, uid)))


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
        cpu_team=cpu_team_name(scenario["name_seed"]) if kind == "indoor" else None,
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
        cpu_team=cpu_team_name(scenario["name_seed"]) if kind == "indoor" else None,
        free_rerolls_left=svc.free_rerolls_left(state),
        reroll_cost=SCENARIO_REROLL_COST,
    )


@router.post("/match/simulate", response_model=MatchSimResult)
async def simulate_match_ep(
    body: MatchSimRequest, session: DbSession, user: CurrentUser
) -> MatchSimResult:
    """Simula a partida para reprodução (inclui pedidos de tempo). Não grava nada:
    pode ser chamada de novo a cada pedido de tempo, mantendo o que já foi jogado."""
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    timeline = [(e.set_no, e.rally_no, e.tactic) for e in body.timeline]
    try:
        result, cpu = await PlayService(session).simulate(
            uid, body.kind, body.sex, body.home_tactic, timeline
        )
    except NotEnoughAthletes as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except TimeoutLimitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MatchSimResult(result=_result_out(result), cpu=CpuInfoOut(**cpu))


@router.post("/match/finish", response_model=MatchFinishResult)
async def finish_match_ep(
    body: MatchSimRequest, session: DbSession, user: CurrentUser
) -> MatchFinishResult:
    """Conclui a partida: re-simula com o mesmo seed/linha do tempo e registra o
    resultado uma única vez (stats, nível, fadiga/lesão, ouro, reputação)."""
    uid = uuid.UUID(user.id)
    await ensure_player_setup(session, uid)
    timeline = [(e.set_no, e.rally_no, e.tactic) for e in body.timeline]
    try:
        state, _result, cpu = await PlayService(session).finish(
            uid, body.kind, body.sex, body.home_tactic, timeline
        )
    except NotEnoughAthletes as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except TimeoutLimitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MatchFinishResult(
        cpu=CpuInfoOut(**cpu),
        state=_to_out(state, await _club(session, uid)),
    )


@router.post("/train", response_model=TrainResult)
async def train_athlete(
    body: TrainRequest, session: DbSession, user: CurrentUser
) -> TrainResult:
    """Treina um atleta do elenco (1 treino por dia por atleta)."""
    uid = uuid.UUID(user.id)
    try:
        athlete = await TrainingService(session).train(uid, body.athlete_id, body.training)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TrainingError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return TrainResult(athlete=AthleteOut.model_validate(athlete))


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
        state=_to_out(state, await _club(session, uid)),
    )
