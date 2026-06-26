"""Serviço de treino: aplica um treino a um atleta do clube do jogador.

Regra: 1 treino por dia (real) por atleta. O treino melhora um atributo e pode
piorar levemente outro; ao final, recalcula a habilidade atual (limitada pelo
potencial) a partir dos atributos.
"""

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.generation import _ALL_ATTRS, _BEACH_WEIGHTS, _COURT_WEIGHTS
from app.engine.training import apply_training, is_valid
from app.enums import BeachPosition, CourtPosition
from app.models.athlete import Athlete
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.user_service import NotFound


class TrainingError(Exception):
    """Treino inválido ou já realizado hoje."""


def recompute_ability(athlete: Athlete) -> None:
    """Recalcula current_ability pela média ponderada dos atributos (cap = potencial)."""
    attrs = athlete.attributes
    if attrs is None:
        return
    weights: dict[str, float] = {}
    if athlete.court_position:
        weights = _COURT_WEIGHTS.get(CourtPosition(athlete.court_position), {})
    elif athlete.beach_position:
        weights = _BEACH_WEIGHTS.get(BeachPosition(athlete.beach_position), {})
    total_w = sum(weights.get(a, 0.5) for a in _ALL_ATTRS) or 1.0
    weighted = sum(getattr(attrs, a) * weights.get(a, 0.5) for a in _ALL_ATTRS)
    current = round(weighted / total_w)
    athlete.current_ability = max(1, min(athlete.potential_ability, current))


class TrainingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def train(
        self, user_id: uuid.UUID, athlete_id: uuid.UUID, training: str
    ) -> Athlete:
        if not is_valid(training):
            raise TrainingError("Treino inválido.")
        club = await UserRepository(self.session).get_main_club(user_id)
        if club is None:
            raise NotFound("Clube não encontrado.")
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        today = date.today()
        if athlete.last_trained_on == today:
            raise TrainingError("Este atleta já treinou hoje. Volte amanhã.")
        apply_training(athlete.attributes, training)
        recompute_ability(athlete)
        athlete.last_trained_on = today
        athlete.market_value = athlete.sale_value
        await self.session.flush()
        return athlete
