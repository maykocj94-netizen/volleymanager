"""Serviço de jogo: cenário estável da partida + simulação autoritativa.

- O cenário (dificuldade, clima, tática e nomes da CPU) fica salvo no estado do
  jogador e só muda quando ele troca de propósito (`reroll`) — evita "farmar"
  partidas fáceis entrando/saindo da aba.
- `reroll`: 3 trocas grátis por semana; depois custa prata.
- `start_match`: monta o time do jogador (pela escalação), sorteia o adversário
  pelo cenário, simula e registra as estatísticas (anti-trapaça no servidor).
"""

import secrets
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.cpu import cpu_names, difficulty_label, roll_scenario
from app.engine.match_engine import MatchContext, MatchResult, TeamUnit, simulate_match
from app.enums import Modality, Sex, Tactic, Weather
from app.models.athlete import Athlete
from app.models.user_state import (
    SCENARIO_FREE_REROLLS,
    SCENARIO_REROLL_COST,
    UserState,
)
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.match_service import build_unit
from app.services.user_service import InsufficientFunds

_TEAM_SIZE = {"beach": 2, "indoor": 6}


class PlayService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    # -- cenário -----------------------------------------------------------
    def _reset_week(self, state: UserState) -> None:
        today = date.today()
        if state.reroll_week_start is None or (today - state.reroll_week_start).days >= 7:
            state.reroll_week_start = today
            state.reroll_count = 0

    def free_rerolls_left(self, state: UserState) -> int:
        return max(0, SCENARIO_FREE_REROLLS - state.reroll_count)

    def _ensure_scenario(self, state: UserState) -> dict:
        if not state.scenario:
            state.scenario = roll_scenario()
        return state.scenario

    async def get_scenario(self, user_id: uuid.UUID) -> tuple[UserState, dict]:
        state = await self.repo.get_or_create_state(user_id)
        self._reset_week(state)
        return state, self._ensure_scenario(state)

    async def reroll(self, user_id: uuid.UUID) -> tuple[UserState, dict]:
        state = await self.repo.get_or_create_state(user_id)
        self._reset_week(state)
        if state.reroll_count >= SCENARIO_FREE_REROLLS:
            if state.silver < SCENARIO_REROLL_COST:
                raise InsufficientFunds(
                    f"Trocas grátis da semana esgotadas. Precisa de {SCENARIO_REROLL_COST} de prata."
                )
            state.silver -= SCENARIO_REROLL_COST
        state.reroll_count += 1
        state.scenario = roll_scenario()
        return state, state.scenario

    # -- partida -----------------------------------------------------------
    async def _home_athletes(
        self, user_id: uuid.UUID, kind: str, sex: Sex
    ) -> tuple[list[Athlete], str]:
        club = await self.repo.get_main_club(user_id)
        if club is None:
            return [], "Meu Time"
        athletes = await AthleteRepository(self.session).list_by_club(club.id)
        pool = [
            a
            for a in athletes
            if a.sex == sex.value
            and (a.beach_position if kind == "beach" else a.court_position)
        ]
        state = await self.repo.get_or_create_state(user_id)
        key = f"{kind}_{'m' if sex is Sex.MALE else 'f'}"
        ids = [str(i) for i in (state.lineup or {}).get(key, [])]
        chosen = [a for a in pool if str(a.id) in ids]
        need = _TEAM_SIZE[kind]
        if len(chosen) < need:
            rest = sorted(
                (a for a in pool if a not in chosen),
                key=lambda a: a.current_ability,
                reverse=True,
            )
            chosen = (chosen + rest)[:need]
        else:
            chosen = chosen[:need]
        return chosen, club.name

    async def start_match(
        self, user_id: uuid.UUID, kind: str, sex: Sex, home_tactic: Tactic
    ) -> tuple[UserState, MatchResult, dict, list[uuid.UUID]]:
        state = await self.repo.get_or_create_state(user_id)
        scenario = self._ensure_scenario(state)
        modality = (Modality.BEACH_M if kind == "beach" else Modality.INDOOR_M).with_sex(sex)
        need = _TEAM_SIZE[kind]

        home_ath, club_name = await self._home_athletes(user_id, kind, sex)
        home = build_unit(club_name, home_ath, tactic=home_tactic, chemistry=65)

        names = cpu_names(scenario["name_seed"], sex, need)
        base = float(scenario["base"])
        away = TeamUnit(
            name="CPU Rivais",
            serve=base, attack=base, block=base, defense=base, reception=base, setting=base,
            players=names, chemistry=55, morale=75, fatigue=0,
            tactic=Tactic(scenario["tactic"]),
        )
        weather = Weather(scenario["weather"]) if kind == "beach" else None
        ctx = MatchContext(modality=modality, weather=weather, seed=secrets.randbits(48))
        result = simulate_match(home, away, ctx)

        # Registra estatísticas (autoritativo).
        won = result.winner == "home"
        state.matches_played += 1
        if won:
            state.matches_won += 1
        else:
            state.matches_lost += 1
        for a in home_ath:
            if won:
                a.wins += 1
            else:
                a.losses += 1
            a.market_value = a.sale_value

        cpu_info = {
            "names": names,
            "tier": scenario["tier"],
            "label": difficulty_label(scenario["tier"]),
            "tactic": scenario["tactic"],
            "weather": scenario["weather"] if kind == "beach" else None,
        }
        return state, result, cpu_info, [a.id for a in home_ath]
