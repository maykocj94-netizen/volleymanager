"""Serviço de jogo: cenário estável da partida + simulação autoritativa.

- O cenário (dificuldade, clima, tática e nomes da CPU) fica salvo no estado do
  jogador e só muda quando ele troca de propósito (`reroll`) — evita "farmar"
  partidas fáceis entrando/saindo da aba.
- `reroll`: 3 trocas grátis por semana; depois custa prata.
- `start_match`: monta o time do jogador (pela escalação), sorteia o adversário
  pelo cenário, simula e registra as estatísticas (anti-trapaça no servidor).
"""

import hashlib
import random
import secrets
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.cpu import cpu_names, cpu_team_name, difficulty_label, roll_scenario
from app.engine.match_engine import MatchContext, MatchResult, TeamUnit, simulate_match
from app.engine.progression import (
    HARD_TIERS,
    apply_level,
    is_available,
    refresh_condition,
    register_play,
    rest_one_game,
)
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
GOLD_PER_WIN = 1
# Pedidos de tempo permitidos por set (1 no vôlei de praia, 2 na quadra).
MAX_TIMEOUTS_PER_SET = {"beach": 1, "indoor": 2}

# Ganho/perda de reputação por resultado e dificuldade do adversário.
_REP_WIN = {"facil": 1, "medio": 2, "dificil": 3, "muito_dificil": 4, "brutal": 6}
_REP_LOSS = {"facil": -3, "medio": -2, "dificil": -1, "muito_dificil": 0, "brutal": 0}


def _next_reputation(current: int, won: bool, tier: str) -> int:
    delta = _REP_WIN.get(tier, 2) if won else _REP_LOSS.get(tier, -1)
    return max(1, min(100, (current or 50) + delta))


class NotEnoughAthletes(Exception):
    """Não há atletas disponíveis (fadigados/lesionados) suficientes."""


class TimeoutLimitError(Exception):
    """Excedeu o número de pedidos de tempo permitidos no set."""


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
    async def _build_home(
        self, user_id: uuid.UUID, kind: str, sex: Sex, now: datetime
    ) -> tuple[list[Athlete], list[Athlete], str]:
        """Devolve (jogadores escalados, reservas da categoria, nome do clube).

        Só entram em quadra atletas disponíveis (não fadigados/lesionados).
        Levanta NotEnoughAthletes se faltar gente disponível.
        """
        club = await self.repo.get_main_club(user_id)
        if club is None:
            return [], [], "Meu Time"
        athletes = await AthleteRepository(self.session).list_by_club(club.id)
        roster = [
            a
            for a in athletes
            if a.sex == sex.value
            and (a.beach_position if kind == "beach" else a.court_position)
        ]
        available = [a for a in roster if is_available(a, now)]
        need = _TEAM_SIZE[kind]
        if len(available) < need:
            raise NotEnoughAthletes(
                f"Você só tem {len(available)} atleta(s) disponível(is) nesta categoria "
                f"(precisa de {need}). Aguarde a recuperação dos fadigados/lesionados."
            )
        state = await self.repo.get_or_create_state(user_id)
        key = f"{kind}_{'m' if sex is Sex.MALE else 'f'}"
        ids = [str(i) for i in (state.lineup or {}).get(key, [])]
        chosen = [a for a in available if str(a.id) in ids]
        if len(chosen) < need:
            rest = sorted(
                (a for a in available if a not in chosen),
                key=lambda a: a.current_ability,
                reverse=True,
            )
            chosen = (chosen + rest)[:need]
        else:
            chosen = chosen[:need]
        bench = [a for a in roster if a not in chosen]
        return chosen, bench, club.name

    def _validate_timeline(
        self, kind: str, timeline: list[tuple[int, int, Tactic]]
    ) -> None:
        """Garante o limite de pedidos de tempo por set (anti-trapaça)."""
        limit = MAX_TIMEOUTS_PER_SET[kind]
        per_set: dict[int, int] = {}
        for set_no, _rally, _tac in timeline:
            per_set[set_no] = per_set.get(set_no, 0) + 1
            if per_set[set_no] > limit:
                raise TimeoutLimitError(
                    f"Só é permitido {limit} pedido(s) de tempo por set nesta modalidade."
                )

    def _match_seed(self, user_id: uuid.UUID, scenario: dict, matches_played: int) -> int:
        """Seed estável da partida: igual entre re-simulações (pedido de tempo) e o
        registro final, e diferente a cada partida concluída (anti-grind de seed)."""
        raw = f"{user_id}-{scenario.get('name_seed')}-{matches_played}".encode()
        return int.from_bytes(hashlib.sha256(raw).digest()[:6], "big")

    async def _setup_match(self, user_id: uuid.UUID, kind: str, sex: Sex, now: datetime):
        state = await self.repo.get_or_create_state(user_id)
        scenario = self._ensure_scenario(state)
        modality = (Modality.BEACH_M if kind == "beach" else Modality.INDOOR_M).with_sex(sex)
        need = _TEAM_SIZE[kind]
        home_ath, bench, club_name = await self._build_home(user_id, kind, sex, now)

        names = cpu_names(scenario["name_seed"], sex, need)
        team_name = cpu_team_name(scenario["name_seed"]) if kind == "indoor" else None
        base = float(scenario["base"])
        away = TeamUnit(
            name=team_name or "CPU Rivais",
            serve=base, attack=base, block=base, defense=base, reception=base, setting=base,
            players=names, chemistry=55, morale=75, fatigue=0,
            tactic=Tactic(scenario["tactic"]),
        )
        weather = Weather(scenario["weather"]) if kind == "beach" else None
        seed = self._match_seed(user_id, scenario, state.matches_played)
        ctx = MatchContext(modality=modality, weather=weather, seed=seed)
        return state, scenario, home_ath, bench, club_name, names, team_name, away, ctx

    def _cpu_info(self, scenario, names, team_name, kind, *, gold=0, statuses=None) -> dict:
        return {
            "names": names,
            "team_name": team_name,
            "tier": scenario["tier"],
            "label": difficulty_label(scenario["tier"]),
            "tactic": scenario["tactic"],
            "weather": scenario["weather"] if kind == "beach" else None,
            "gold_awarded": gold,
            "statuses": statuses or {},
        }

    async def simulate(
        self,
        user_id: uuid.UUID,
        kind: str,
        sex: Sex,
        home_tactic: Tactic,
        timeline: list[tuple[int, int, Tactic]],
    ) -> tuple[MatchResult, dict]:
        """Simula a partida para reprodução (com pedidos de tempo). NÃO grava nada
        — o registro autoritativo acontece em `finish`."""
        self._validate_timeline(kind, timeline)
        now = datetime.now(timezone.utc)
        (_state, scenario, home_ath, _bench, club_name,
         names, team_name, away, ctx) = await self._setup_match(user_id, kind, sex, now)
        home = build_unit(club_name, home_ath, tactic=home_tactic, chemistry=65)
        result = simulate_match(home, away, ctx, timeline=timeline)
        return result, self._cpu_info(scenario, names, team_name, kind)

    async def finish(
        self,
        user_id: uuid.UUID,
        kind: str,
        sex: Sex,
        home_tactic: Tactic,
        timeline: list[tuple[int, int, Tactic]],
    ) -> tuple[UserState, MatchResult, dict]:
        """Re-simula com o MESMO seed/linha do tempo e registra o resultado uma vez
        (stats, nível, fadiga/lesão, ouro, reputação). Determinístico = anti-trapaça."""
        self._validate_timeline(kind, timeline)
        now = datetime.now(timezone.utc)
        (state, scenario, home_ath, bench, club_name,
         names, team_name, away, ctx) = await self._setup_match(user_id, kind, sex, now)
        home = build_unit(club_name, home_ath, tactic=home_tactic, chemistry=65)
        result = simulate_match(home, away, ctx, timeline=timeline)

        won = result.winner == "home"
        hard = scenario["tier"] in HARD_TIERS
        rng = random.Random(secrets.randbits(48))
        state.matches_played += 1
        if won:
            state.matches_won += 1
            state.gold += GOLD_PER_WIN
        else:
            state.matches_lost += 1

        club = await self.repo.get_main_club(user_id)
        if club is not None:
            club.reputation = _next_reputation(club.reputation, won, scenario["tier"])

        statuses: dict[str, str] = {}
        for a in home_ath:
            if won:
                a.wins += 1
            else:
                a.losses += 1
            apply_level(a, won, rng)
            changed = register_play(a, hard=hard, rng=rng, now=now)
            if changed:
                statuses[str(a.id)] = changed
            a.market_value = a.sale_value
        for a in bench:
            refresh_condition(a, now)
            rest_one_game(a)

        cpu_info = self._cpu_info(
            scenario, names, team_name, kind,
            gold=GOLD_PER_WIN if won else 0, statuses=statuses,
        )
        return state, result, cpu_info
