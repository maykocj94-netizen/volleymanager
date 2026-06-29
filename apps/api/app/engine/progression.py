"""Progressão de atletas: nível (LVL) e ecossistema de fadiga/lesão.

Funções puras que operam sobre o model `Athlete` (mutam campos), sem tocar no
banco — o serviço chama estas funções dentro de uma transação.

Nível
-----
- Começa em 1, máximo 999.
- Ganhar e perder partidas dá XP; ganhar dá bem mais.
- Até o nível 50, sobe a cada 7–15 vitórias (XP de vitória 67–143, limiar 1000).
- A partir do 50 o limiar cresce, dificultando progressivamente.

Anti-spam por TEMPO (fadiga/lesão)
----------------------------------
- O risco só existe ao jogar em sequência RÁPIDA (uma partida logo após a
  outra, com menos de 1 minuto entre elas). Jogar com pelo menos 1 minuto de
  intervalo zera o acúmulo: o atleta não fadiga nem lesiona.
- Fadiga: ao atingir 5 partidas rápidas seguidas, o atleta fadiga e fica de
  fora por 3–5 jogos.
- Lesão: partidas rápidas e difíceis em sequência têm chance de lesão; ao
  lesionar, o atleta fica de fora por no máximo 3 DIAS reais.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

LEVEL_MAX = 999

# Intervalo mínimo (segundos) para a partida NÃO contar como "rápida" (spam).
RAPID_GAP_SECONDS = 60
FATIGUE_TRIGGER = 5      # nº de partidas rápidas seguidas que fadiga o atleta
INJURY_TRIGGER = 4       # nº de partidas rápidas difíceis seguidas p/ risco de lesão
INJURY_MAX_DAYS = 3      # lesão dura no máximo 3 dias reais

HARD_TIERS = {"dificil", "muito_dificil", "brutal"}

# Atributos que evoluem (sutilmente) com a experiência ao subir de nível.
_GROWTH_ATTRS = [
    "serve", "attack", "block", "defense", "reception", "setting", "speed",
    "jump", "stamina", "positioning", "decision", "concentration", "competitiveness",
]


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


def grow_with_experience(athlete, levels: int, rng: random.Random) -> None:
    """Evolução SUTIL ao subir de nível: o atleta ganha experiência.

    Por nível ganho: +1 na habilidade atual (até o potencial) e +1 em um
    atributo aleatório (teto 99). Indica o desenvolvimento com o tempo.
    """
    if levels <= 0:
        return
    attrs = getattr(athlete, "attributes", None)
    pa = athlete.potential_ability or 99
    for _ in range(levels):
        if (athlete.current_ability or 0) < pa:
            athlete.current_ability = min(pa, (athlete.current_ability or 0) + 1)
        if attrs is not None:
            key = rng.choice(_GROWTH_ATTRS)
            cur = getattr(attrs, key, 50) or 50
            if cur < 99:
                setattr(attrs, key, cur + 1)


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
    gained = athlete.level - before
    grow_with_experience(athlete, gained, rng)
    return gained


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

    Risco só ocorre em partidas RÁPIDAS em sequência (< 1 min entre elas).
    Partidas espaçadas (>= 1 min) zeram o acúmulo — sem fadiga nem lesão.
    Devolve "fatigued" / "injured" se passou a esse estado, senão None.
    """
    last = athlete.last_played_at
    gap = (now - _aware(last)).total_seconds() if last is not None else None
    athlete.last_played_at = now
    rapid = gap is not None and gap < RAPID_GAP_SECONDS

    if not rapid:
        # Partida espaçada (ou a primeira): descansou o suficiente. Inicia uma
        # nova sequência com esta partida — uma única partida nunca causa risco.
        athlete.games_since_rest = 1
        athlete.hard_streak = 1 if hard else 0
        return None

    # Sequência de partidas rápidas (spam): acumula risco.
    # Lesão tem prioridade (mais grave). Jogos rápidos E difíceis em sequência.
    if hard:
        athlete.hard_streak = (athlete.hard_streak or 0) + 1
        if athlete.hard_streak >= INJURY_TRIGGER:
            chance = (athlete.hard_streak - (INJURY_TRIGGER - 1)) * 0.18
            if rng.random() < chance:
                days = rng.randint(1, INJURY_MAX_DAYS)
                athlete.condition = "injured"
                athlete.is_injured = True
                athlete.injured_until = now + timedelta(days=days)
                athlete.hard_streak = 0
                athlete.games_since_rest = 0
                return "injured"
    else:
        athlete.hard_streak = 0

    # Fadiga ao atingir 5 partidas rápidas seguidas.
    athlete.games_since_rest = (athlete.games_since_rest or 0) + 1
    if athlete.games_since_rest >= FATIGUE_TRIGGER:
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
