"""Controller: partidas (modo exibição — testa a engine sem precisar de DB)."""

from fastapi import APIRouter

from app.engine.match_engine import MatchContext, TeamUnit, simulate_match
from app.schemas.match import ExhibitionRequest, MatchResultOut

router = APIRouter(prefix="/matches", tags=["matches"])


def _to_unit(spec) -> TeamUnit:  # noqa: ANN001
    return TeamUnit(
        name=spec.name,
        serve=spec.serve, attack=spec.attack, block=spec.block,
        defense=spec.defense, reception=spec.reception, setting=spec.setting,
        players=spec.players, chemistry=spec.chemistry,
        morale=spec.morale, fatigue=spec.fatigue, tactic=spec.tactic,
    )


@router.post("/exhibition", response_model=MatchResultOut)
async def exhibition(body: ExhibitionRequest) -> MatchResultOut:
    """Simula uma partida amistosa a partir de forças agregadas.

    Determinístico: o mesmo `seed` sempre produz o mesmo resultado.
    """
    ctx = MatchContext(modality=body.modality, weather=body.weather, seed=body.seed or 0)
    result = simulate_match(_to_unit(body.home), _to_unit(body.away), ctx)
    return MatchResultOut(
        home_sets=result.home_sets,
        away_sets=result.away_sets,
        winner=result.winner,
        sets=[{"set_no": s.set_no, "home": s.home, "away": s.away} for s in result.sets],
        events=[
            {
                "set_no": e.set_no, "rally_no": e.rally_no, "event_type": e.event_type,
                "side": e.side, "text": e.text, "athlete": e.athlete,
            }
            for e in result.events
        ],
    )
