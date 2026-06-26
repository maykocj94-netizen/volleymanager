"""Progressão de atletas: nível (LVL) e ecossistema de fadiga/lesão.

Funções puras que operam sobre o model `Athlete` (mutam campos), sem tocar no
banco — o serviço chama estas funções dentro de uma transação.

Nível
-----
- Começa em 1, máximo 999.
- Ganhar e perder partidas dá XP; ganhar dá bem mais.
- Até o nível 50, sobe a cada 7–15 vitórias (XP de vitória 67–143, limiar 1000).
- A partir do 50 o limiar cresce, dificultando progressivamente.

Fadiga ("fatigued")
-------------------
- Cada partida jogada acumula uso; a partir de ~8 jogos seguidos há chance
  crescente de fadigar. Fadigado, o atleta fica de fora por 3–5 jogos.

Lesão ("injured")
-----------------
- Jogos de dificuldade "difícil" pra cima em sequência acumulam risco; ao
  lesionar, o atleta fica de fora por 5–10 DIAS REAIS.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

LEVEL_MAX = 999

FATIGUE_TRIGGER = 8      # a partir deste nº de jogos seguidos pode fadigar
INJURY_TRIGGER = 4       # a partir deste nº de jogos difíceis seguidos pode lesionar

HARD_TIERS = {"dificil", "muito_dificil", "brutal"}


# -- nível ------------------------------------------------------------------
def level_threshold(level: int) -> int:
    """XP necessário para sair de `level` para o próximo."""
    if level < 50:
        return 1000
    return round(1000 * (1 + (level - 50) * 0.05))


def _gain_for_match(won: bool, rng: random.Random) -> int:
    if won:
        return rng.randint(67, 143)   # 7–15 vitórias por nível (até o 50)
    return rng.randint(16, 42)        # derrota progride bem menos


def apply_level(athlete, won: bool, rng: random.Random) -> int:
    """Aplica XP e sobe de nível. Devolve quantos níveis subiu."""
    if athlete.level >= LEVEL_MAX:
        return 0
    before = athlete.level
    athlete.level_xp = (athlete.level_xp or 0) + _gain_for_match(won, rng)
    while athlete.level < LEVEL_MAX and athlete.level_xp >= level_threshold(athlete.level):
        athlete.level_xp -= level_threshold(athlete.level)
        athlete.level += 1
    if athlete.level >= LEVEL_MAX:
        athlete.level = LEVEL_MAX
        athlete.level_xp = 0
    return athlete.level - before


# -- condição (fadiga / lesão) ---------------------------------------------
def refresh_condition(athlete, now: datetime) -> None:
    """Recuperação preguiçosa de lesão por tempo real (chamar ao ler/usar)."""
    if (
        athlete.condition == "injured"
        and athlete.injured_until is not None
        and now >= _aware(athlete.injured_until)
    ):
        athlete.condition = "ok"
        athlete.is_injured = False
        athlete.injured_until = None
        athlete.hard_streak = 0


def is_available(athlete, now: datetime) -> bool:
    refresh_condition(athlete, now)
    return athlete.condition == "ok"


def register_play(athlete, *, hard: bool, rng: random.Random, now: datetime) -> str | None:
    """Registra que o atleta jogou uma partida e rola fadiga/lesão.

    Devolve "fatigued" / "injured" se passou a esse estado, senão None.
    """
    # Lesão tem prioridade (mais grave). Jogos difíceis em sequência.
    if hard:
        athlete.hard_streak = (athlete.hard_streak or 0) + 1
        if athlete.hard_streak >= INJURY_TRIGGER:
            chance = (athlete.hard_streak - (INJURY_TRIGGER - 1)) * 0.18
            if rng.random() < chance:
                days = rng.randint(5, 10)
                athlete.condition = "injured"
                athlete.is_injured = True
                athlete.injured_until = now + timedelta(days=days)
                athlete.hard_streak = 0
                athlete.games_since_rest = 0
                return "injured"
    else:
        athlete.hard_streak = 0

    # Fadiga por uso repetido.
    athlete.games_since_rest = (athlete.games_since_rest or 0) + 1
    if athlete.games_since_rest >= FATIGUE_TRIGGER:
        chance = (athlete.games_since_rest - (FATIGUE_TRIGGER - 1)) * 0.22
        if rng.random() < chance:
            athlete.condition = "fatigued"
            athlete.rest_games_left = rng.randint(3, 5)
            athlete.games_since_rest = 0
            return "fatigued"
    return None


def rest_one_game(athlete) -> None:
    """Conta um jogo de descanso para um atleta fadigado que ficou de fora."""
    if athlete.condition == "fatigued" and (athlete.rest_games_left or 0) > 0:
        athlete.rest_games_left -= 1
        if athlete.rest_games_left <= 0:
            athlete.condition = "ok"
            athlete.rest_games_left = 0


def _aware(dt: datetime) -> datetime:
    """SQLite devolve datetime ingênuo; trata como UTC para comparar."""
    from datetime import timezone
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
