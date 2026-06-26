"""Regra de negócio de partidas: monta as unidades e roda a engine."""

import secrets

from app.engine.match_engine import (
    MatchContext,
    MatchResult,
    TeamUnit,
    simulate_match,
)
from app.models.athlete import Athlete
from app.enums import Modality, Tactic, Weather


def _avg(athletes: list[Athlete], attr: str) -> float:
    """Média de um atributo da escalação (0–100)."""
    if not athletes:
        return 50.0
    vals = [getattr(a.attributes, attr) for a in athletes if a.attributes]
    return sum(vals) / len(vals) if vals else 50.0


def build_unit(
    name: str,
    athletes: list[Athlete],
    *,
    tactic: Tactic = Tactic.BALANCED,
    chemistry: float = 50.0,
) -> TeamUnit:
    """Converte uma escalação de atletas numa unidade para a engine."""
    return TeamUnit(
        name=name,
        serve=_avg(athletes, "serve"),
        attack=_avg(athletes, "attack"),
        block=_avg(athletes, "block"),
        defense=_avg(athletes, "defense"),
        reception=_avg(athletes, "reception"),
        setting=_avg(athletes, "setting"),
        players=[a.full_name for a in athletes],
        chemistry=chemistry,
        morale=sum(a.morale for a in athletes) / len(athletes) if athletes else 70.0,
        fatigue=sum(a.fatigue for a in athletes) / len(athletes) if athletes else 0.0,
        tactic=tactic,
    )


def simulate(
    home: TeamUnit,
    away: TeamUnit,
    *,
    modality: Modality,
    weather: Weather | None = None,
    seed: int | None = None,
) -> MatchResult:
    """Roda a engine de forma determinística."""
    ctx = MatchContext(
        modality=modality,
        weather=weather,
        seed=seed if seed is not None else secrets.randbits(48),
    )
    return simulate_match(home, away, ctx)
