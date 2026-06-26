"""WebSocket: narração de partida ao vivo.

Cliente conecta em /ws/match/exhibition e envia o JSON da partida (igual ao
endpoint REST de exibição). O servidor roda a engine e transmite cada evento
de narração com um pequeno atraso, criando a sensação de jogo ao vivo.
"""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.api.v1.matches import _to_unit
from app.engine.match_engine import MatchContext, simulate_match
from app.schemas.match import ExhibitionRequest

router = APIRouter()

# Atraso entre eventos (s). Em produção, ajustável por velocidade de narração.
_EVENT_DELAY = 0.6


@router.websocket("/ws/match/exhibition")
async def ws_exhibition(ws: WebSocket) -> None:
    await ws.accept()
    try:
        raw = await ws.receive_json()
        body = ExhibitionRequest.model_validate(raw)
    except (ValidationError, ValueError) as exc:
        await ws.send_json({"type": "error", "detail": str(exc)})
        await ws.close()
        return

    ctx = MatchContext(modality=body.modality, weather=body.weather, seed=body.seed or 0)
    result = simulate_match(_to_unit(body.home), _to_unit(body.away), ctx)

    await ws.send_json({"type": "start", "home": body.home.name, "away": body.away.name})
    try:
        for ev in result.events:
            await ws.send_json({
                "type": "event",
                "set_no": ev.set_no,
                "rally_no": ev.rally_no,
                "event_type": ev.event_type,
                "side": ev.side,
                "text": ev.text,
                "athlete": ev.athlete,
            })
            await asyncio.sleep(_EVENT_DELAY)
        await ws.send_json({
            "type": "end",
            "home_sets": result.home_sets,
            "away_sets": result.away_sets,
            "winner": result.winner,
            "sets": [{"set_no": s.set_no, "home": s.home, "away": s.away} for s in result.sets],
        })
    except WebSocketDisconnect:
        return
    finally:
        await ws.close()
