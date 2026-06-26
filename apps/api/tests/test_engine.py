"""Testes da engine pura (sem DB): determinismo e geração."""

from app.engine.generation import generate_athletes
from app.engine.match_engine import MatchContext, TeamUnit, simulate_match
from app.enums import Modality, Tactic


def _unit(name: str, base: float, tactic: Tactic = Tactic.BALANCED) -> TeamUnit:
    return TeamUnit(
        name=name, serve=base, attack=base, block=base, defense=base,
        reception=base, setting=base, players=[f"{name} P1", f"{name} P2"],
        tactic=tactic,
    )


def test_match_is_deterministic():
    ctx = MatchContext(modality=Modality.BEACH_M, seed=12345)
    r1 = simulate_match(_unit("A", 70), _unit("B", 60), ctx)
    r2 = simulate_match(_unit("A", 70), _unit("B", 60), ctx)
    assert (r1.home_sets, r1.away_sets) == (r2.home_sets, r2.away_sets)
    assert [e.text for e in r1.events] == [e.text for e in r2.events]


def test_beach_is_best_of_three():
    ctx = MatchContext(modality=Modality.BEACH_M, seed=7)
    r = simulate_match(_unit("A", 80), _unit("B", 40), ctx)
    assert max(r.home_sets, r.away_sets) == 2
    assert r.home_sets + r.away_sets <= 3


def test_indoor_is_best_of_five():
    ctx = MatchContext(modality=Modality.INDOOR_M, seed=7)
    r = simulate_match(_unit("A", 80), _unit("B", 40), ctx)
    assert max(r.home_sets, r.away_sets) == 3
    assert r.home_sets + r.away_sets <= 5


def test_stronger_team_wins_more_often():
    wins = 0
    for seed in range(40):
        ctx = MatchContext(modality=Modality.INDOOR_M, seed=seed)
        r = simulate_match(_unit("Strong", 85), _unit("Weak", 45), ctx)
        if r.winner == "home":
            wins += 1
    assert wins > 30  # time muito mais forte vence a grande maioria


def test_generation_is_deterministic():
    a = generate_athletes(modality=Modality.BEACH_F, count=5, seed=99)
    b = generate_athletes(modality=Modality.BEACH_F, count=5, seed=99)
    assert [x.first_name for x in a] == [y.first_name for y in b]
    assert all(0 <= x.current_ability <= x.potential_ability <= 100 for x in a)
