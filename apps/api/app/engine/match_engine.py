"""Engine de simulação de partida — determinística por seed, sem física.

Modelo matemático rally-a-rally. As probabilidades de cada fase (saque,
recepção, levantamento, ataque, bloqueio/defesa) saem das forças agregadas
da equipe, ajustadas por tática, clima, moral, cansaço e entrosamento.

A função `simulate_match` é pura: mesma entrada + mesmo seed → mesma saída.
Isso permite o servidor reproduzir/auditar qualquer partida (anti-trapaça).
"""

import random
from dataclasses import dataclass, field

from app.enums import Modality, Tactic, Weather

# ---------------------------------------------------------------------------
# Estado de entrada
# ---------------------------------------------------------------------------


@dataclass
class TeamUnit:
    """Forças agregadas de uma equipe (0–100) + contexto."""

    name: str
    serve: float
    attack: float
    block: float
    defense: float
    reception: float
    setting: float
    players: list[str] = field(default_factory=list)  # nomes p/ narração
    chemistry: float = 50.0   # entrosamento (0–100), peso maior no beach
    morale: float = 70.0
    fatigue: float = 0.0
    tactic: Tactic = Tactic.BALANCED


@dataclass
class MatchContext:
    modality: Modality
    weather: Weather | None = None
    seed: int = 0


# ---------------------------------------------------------------------------
# Saída
# ---------------------------------------------------------------------------


@dataclass
class MatchEvent:
    set_no: int
    rally_no: int
    event_type: str
    side: str          # "home" | "away" | "info"
    text: str
    athlete: str | None = None


@dataclass
class SetScore:
    set_no: int
    home: int
    away: int


@dataclass
class MatchResult:
    home_sets: int
    away_sets: int
    sets: list[SetScore]
    events: list[MatchEvent]
    winner: str        # "home" | "away"


# ---------------------------------------------------------------------------
# Modificadores
# ---------------------------------------------------------------------------

_TACTIC_MOD: dict[Tactic, dict[str, float]] = {
    Tactic.VERY_OFFENSIVE: {"attack": 1.12, "serve": 1.08, "defense": 0.88, "reception": 0.92},
    Tactic.OFFENSIVE: {"attack": 1.06, "serve": 1.04, "defense": 0.95, "reception": 0.97},
    Tactic.BALANCED: {},
    Tactic.DEFENSIVE: {"attack": 0.95, "serve": 0.97, "defense": 1.06, "reception": 1.04},
    Tactic.VERY_DEFENSIVE: {"attack": 0.88, "serve": 0.92, "defense": 1.12, "reception": 1.08},
}

# Clima afeta saque, recepção e levantamento (sobretudo no vôlei de praia).
_WEATHER_MOD: dict[Weather, dict[str, float]] = {
    Weather.SUNNY: {},
    Weather.CLOUDY: {},
    Weather.RAIN: {"serve": 0.94, "reception": 0.92, "setting": 0.93},
    Weather.LIGHT_WIND: {"serve": 0.97, "reception": 0.96, "setting": 0.97},
    Weather.STRONG_WIND: {"serve": 0.88, "reception": 0.86, "setting": 0.85},
}


def _eff(unit: TeamUnit, attr: str, ctx: MatchContext) -> float:
    """Força efetiva de um fundamento após táticas, clima, moral, cansaço."""
    base = getattr(unit, attr)
    base *= _TACTIC_MOD.get(unit.tactic, {}).get(attr, 1.0)
    if ctx.weather:
        base *= _WEATHER_MOD.get(ctx.weather, {}).get(attr, 1.0)
    # Moral: ±8%. Cansaço: até -15%.
    base *= 0.96 + (unit.morale / 100) * 0.08
    base *= 1.0 - (unit.fatigue / 100) * 0.15
    # Entrosamento dá um pequeno bônus geral (mais forte no beach).
    chem_weight = 0.06 if ctx.modality.is_beach else 0.03
    base *= 1.0 + ((unit.chemistry - 50) / 100) * chem_weight
    return max(1.0, base)


def _contest(rng: random.Random, a: float, b: float) -> bool:
    """True se 'a' vence o confronto probabilístico contra 'b'."""
    total = a + b
    return rng.random() < (a / total if total > 0 else 0.5)


def _pick(rng: random.Random, names: list[str]) -> str | None:
    return rng.choice(names) if names else None


# ---------------------------------------------------------------------------
# Simulação de um rally
# ---------------------------------------------------------------------------


def _play_rally(
    rng: random.Random,
    serving: TeamUnit,
    receiving: TeamUnit,
    ctx: MatchContext,
    set_no: int,
    rally_no: int,
    side_serving: str,
) -> tuple[str, list[MatchEvent]]:
    """Joga um rally. Retorna (lado_que_pontuou, eventos)."""
    side_recv = "away" if side_serving == "home" else "home"
    events: list[MatchEvent] = []
    server = _pick(rng, serving.players)
    events.append(MatchEvent(set_no, rally_no, "serve", side_serving,
                             f"{server or serving.name} vai ao saque.", server))

    # Ace direto?
    serve_pow = _eff(serving, "serve", ctx)
    recv_pow = _eff(receiving, "reception", ctx)
    if _contest(rng, serve_pow * 0.35, recv_pow):
        events.append(MatchEvent(set_no, rally_no, "ace", side_serving,
                                 "ACE! Saque indefensável.", server))
        return side_serving, events

    # Recepção
    if _contest(rng, recv_pow, serve_pow):
        events.append(MatchEvent(set_no, rally_no, "reception", side_recv, "Boa recepção."))
    else:
        events.append(MatchEvent(set_no, rally_no, "reception", side_recv,
                                 "Recepção ruim, sobra para o adversário."))
        if _contest(rng, serve_pow, recv_pow * 0.8):
            return side_serving, events  # ponto do saque por erro de recepção

    # A partir daqui o sideout fica com quem recebeu; entram em rally aberto.
    attacker, defender = receiving, serving
    side_atk, side_def = side_recv, side_serving

    for _exchange in range(6):  # limita o comprimento do rally
        setter = _pick(rng, attacker.players)
        events.append(MatchEvent(set_no, rally_no, "set", side_atk,
                                 "Levantamento na rede.", setter))
        atk_pow = _eff(attacker, "attack", ctx)
        blk_pow = _eff(defender, "block", ctx)
        def_pow = _eff(defender, "defense", ctx)
        hitter = _pick(rng, attacker.players)

        # Bloqueio?
        if _contest(rng, blk_pow * 0.45, atk_pow):
            events.append(MatchEvent(set_no, rally_no, "block", side_def,
                                     "BLOQUEIO! Ponto da defesa.", _pick(rng, defender.players)))
            return side_def, events

        # Ataque convertido?
        if _contest(rng, atk_pow, def_pow):
            events.append(MatchEvent(set_no, rally_no, "attack", side_atk,
                                     "Ataque na diagonal — PONTO!", hitter))
            return side_atk, events

        # Defendeu: troca de lado e continua o rally.
        events.append(MatchEvent(set_no, rally_no, "dig", side_def,
                                 "Defesa espetacular, o rally continua!"))
        attacker, defender = defender, attacker
        side_atk, side_def = side_def, side_atk

    # Rally muito longo: decide pelo melhor ataque.
    winner = side_atk if _contest(rng, _eff(attacker, "attack", ctx),
                                  _eff(defender, "defense", ctx)) else side_def
    events.append(MatchEvent(set_no, rally_no, "attack", winner, "Ponto após rally longo!"))
    return winner, events


# ---------------------------------------------------------------------------
# Simulação de um set e da partida
# ---------------------------------------------------------------------------


def _set_target(modality: Modality, set_no: int, sets_to_win: int, decider: bool) -> int:
    if modality.is_beach:
        return 15 if decider else 21
    return 15 if decider else 25


def _resolve_home_tactic(
    timeline: list[tuple[int, int, Tactic]], initial: Tactic, set_no: int, rally_no: int
) -> Tactic:
    """Tática do mandante neste rally, considerando os pedidos de tempo.

    `timeline` é uma lista ordenada de (set, rally, tática): a partir daquele
    rally daquele set, o mandante passa a jogar com a nova tática.
    """
    active = initial
    for s, r, tac in timeline:
        if (s, r) <= (set_no, rally_no):
            active = tac
        else:
            break
    return active


def _play_set(
    rng: random.Random,
    home: TeamUnit,
    away: TeamUnit,
    ctx: MatchContext,
    set_no: int,
    decider: bool,
    home_initial: Tactic,
    timeline: list[tuple[int, int, Tactic]],
) -> tuple[SetScore, list[MatchEvent], str]:
    target = _set_target(ctx.modality, set_no, 0, decider)
    h = a = rally = 0
    serving_side = "home" if (set_no % 2 == 1) else "away"
    events: list[MatchEvent] = [
        MatchEvent(set_no, 0, "set_start", "info", f"Início do set {set_no} (até {target}).")
    ]
    # A cada novo set as equipes trocam de lado da quadra.
    if set_no > 1:
        events.append(MatchEvent(set_no, 0, "side_switch", "info",
                                 "As equipes trocam de lado da quadra."))
    while True:
        rally += 1
        # Aplica a tática vigente do mandante (muda com pedidos de tempo).
        home.tactic = _resolve_home_tactic(timeline, home_initial, set_no, rally)
        serving = home if serving_side == "home" else away
        receiving = away if serving_side == "home" else home
        scorer, rally_events = _play_rally(
            rng, serving, receiving, ctx, set_no, rally, serving_side
        )
        events.extend(rally_events)
        if scorer == "home":
            h += 1
        else:
            a += 1
        # Marcador autoritativo de ponto (placar corrente) para o cliente.
        events.append(MatchEvent(set_no, rally, "point", scorer, f"{h} x {a}"))
        set_over = (h >= target or a >= target) and abs(h - a) >= 2
        # Vôlei de praia: troca de lado a cada múltiplo de 7 pontos somados.
        if ctx.modality.is_beach and not set_over and (h + a) > 0 and (h + a) % 7 == 0:
            events.append(MatchEvent(set_no, rally, "side_switch", "info",
                                     f"Troca de lado (soma {h + a} pontos)."))
        serving_side = scorer  # quem pontua, saca
        # cansaço acumula levemente a cada rally
        home.fatigue = min(100.0, home.fatigue + 0.15)
        away.fatigue = min(100.0, away.fatigue + 0.15)

        if set_over:
            break

    winner = "home" if h > a else "away"
    events.append(MatchEvent(set_no, rally, "set_end", "info",
                             f"Fim do set {set_no}: {h} x {a}."))
    return SetScore(set_no, h, a), events, winner


def simulate_match(
    home: TeamUnit,
    away: TeamUnit,
    ctx: MatchContext,
    timeline: list[tuple[int, int, Tactic]] | None = None,
) -> MatchResult:
    """Simula a partida inteira de forma determinística.

    `timeline` (pedidos de tempo): lista de (set, rally, tática) a partir da qual
    o mandante muda de tática. Como o prefixo (antes da troca) consome o RNG de
    forma idêntica, re-simular com um novo pedido de tempo mantém tudo que já foi
    jogado e só altera o restante — perfeito para o cliente "emendar" a narração.
    """
    rng = random.Random(ctx.seed)
    sets_to_win = 2 if ctx.modality.is_beach else 3
    max_sets = sets_to_win * 2 - 1
    initial = home.tactic
    tl = sorted(timeline or [])

    home_sets = away_sets = 0
    set_scores: list[SetScore] = []
    all_events: list[MatchEvent] = [
        MatchEvent(0, 0, "match_start", "info",
                   f"{home.name} x {away.name} — {ctx.modality.value}.")
    ]

    for set_no in range(1, max_sets + 1):
        decider = (set_no == max_sets)
        score, events, winner = _play_set(rng, home, away, ctx, set_no, decider, initial, tl)
        set_scores.append(score)
        all_events.extend(events)
        if winner == "home":
            home_sets += 1
        else:
            away_sets += 1
        if home_sets == sets_to_win or away_sets == sets_to_win:
            break

    winner = "home" if home_sets > away_sets else "away"
    win_name = home.name if winner == "home" else away.name
    all_events.append(MatchEvent(0, 0, "match_end", "info",
                                 f"Fim de jogo! {win_name} venceu por {home_sets} x {away_sets}."))
    return MatchResult(home_sets, away_sets, set_scores, all_events, winner)
