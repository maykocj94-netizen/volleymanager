"""Regra de negócio de atletas: geração procedural, consultas."""

import secrets
import uuid
from datetime import date

from app.engine.generation import (
    _ALL_ATTRS,
    _BEACH_WEIGHTS,
    _COURT_WEIGHTS,
    GeneratedAthlete,
    generate_athletes,
)
from app.models.athlete import Athlete, AthleteAttributes
from app.enums import BeachPosition, CourtPosition, Modality, Sex
from app.repositories.athlete_repo import AthleteRepository


class AthleteService:
    def __init__(self, repo: AthleteRepository) -> None:
        self.repo = repo

    async def generate(
        self,
        *,
        modality: Modality,
        count: int,
        country: str = "BRA",
        seed: int | None = None,
        club_id: uuid.UUID | None = None,
        random_sex: bool = False,
        max_ability: int | None = None,
    ) -> list[Athlete]:
        """Gera atletas proceduralmente e persiste. `max_ability` limita a
        pontuação final (revelação nasce fraca)."""
        seed = seed if seed is not None else secrets.randbits(48)
        generated = generate_athletes(
            modality=modality, count=count, seed=seed, country=country,
            random_sex=random_sex, max_ability=max_ability,
        )
        created: list[Athlete] = []
        for g in generated:
            athlete, attrs = self._to_models(g, club_id)
            self.repo.add(athlete, attrs)
            created.append(athlete)
        await self.repo.flush()
        return created

    @staticmethod
    def _to_models(
        g: GeneratedAthlete, club_id: uuid.UUID | None
    ) -> tuple[Athlete, AthleteAttributes]:
        athlete = Athlete(
            id=uuid.uuid4(),
            club_id=club_id,
            first_name=g.first_name,
            last_name=g.last_name,
            country=g.country,
            birth_date=g.birth_date,
            height_cm=g.height_cm,
            weight_kg=g.weight_kg,
            handedness=g.handedness.value,
            sex=g.sex.value,
            modality=g.modality.value,
            court_position=g.court_position.value if g.court_position else None,
            beach_position=g.beach_position.value if g.beach_position else None,
            current_ability=g.current_ability,
            potential_ability=g.potential_ability,
        )
        # Valor de mercado inicial = preço de venda base (sem histórico ainda).
        athlete.market_value = athlete.sale_value
        a = g.attributes
        attrs = AthleteAttributes(
            athlete_id=athlete.id,
            serve=a.serve, attack=a.attack, block=a.block, defense=a.defense,
            reception=a.reception, setting=a.setting, speed=a.speed, jump=a.jump,
            stamina=a.stamina, positioning=a.positioning, decision=a.decision,
            concentration=a.concentration, competitiveness=a.competitiveness,
        )
        # Vincula o relacionamento em memória para que a serialização não
        # dispare lazy-load assíncrono logo após o flush.
        athlete.attributes = attrs
        return athlete, attrs

    async def list_by_club(self, club_id: uuid.UUID) -> list[Athlete]:
        return await self.repo.list_by_club(club_id)

    async def create_custom(
        self,
        *,
        first_name: str,
        last_name: str,
        country: str,
        sex: Sex,
        modality: Modality,
        court_position: CourtPosition | None,
        beach_position: BeachPosition | None,
        height_cm: int,
        weight_kg: int,
        birth_date: date,
        attributes: dict[str, int],
    ) -> Athlete:
        """Cria um atleta personalizado (Mercado → Contratações). Sem clube."""
        # Habilidade atual = média dos atributos ponderada pela posição.
        if court_position is not None:
            weights = _COURT_WEIGHTS[court_position]
        elif beach_position is not None:
            weights = _BEACH_WEIGHTS[beach_position]
        else:
            weights = {}
        total_w = sum(weights.get(a, 0.5) for a in _ALL_ATTRS) or 1.0
        weighted = sum(attributes.get(a, 50) * weights.get(a, 0.5) for a in _ALL_ATTRS)
        current = max(25, min(99, round(weighted / total_w)))
        potential = max(current, min(99, current + 5))

        athlete = Athlete(
            id=uuid.uuid4(),
            club_id=None,
            first_name=first_name,
            last_name=last_name,
            country=country,
            birth_date=birth_date,
            height_cm=height_cm,
            weight_kg=weight_kg,
            handedness="right",
            sex=sex.value,
            modality=modality.value,
            court_position=court_position.value if court_position else None,
            beach_position=beach_position.value if beach_position else None,
            current_ability=current,
            potential_ability=potential,
            is_custom=True,
        )
        attrs = AthleteAttributes(athlete_id=athlete.id, **{a: attributes.get(a, 50) for a in _ALL_ATTRS})
        athlete.attributes = attrs
        athlete.market_value = athlete.sale_value
        self.repo.add(athlete, attrs)
        await self.repo.flush()
        return athlete
