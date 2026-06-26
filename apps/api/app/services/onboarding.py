"""Onboarding do jogador: garante carteira, clube e elenco inicial.

Usado tanto pelo seed de desenvolvimento quanto, em produção, no primeiro
acesso de cada usuário (chamado pelos endpoints de `/me`). É idempotente.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import Modality
from app.models.athlete import Athlete
from app.models.club import Club
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.athlete_service import AthleteService

# Modalidades semeadas no elenco inicial (uma dupla/sexteto de cada categoria).
_STARTER_SQUADS: list[tuple[Modality, int]] = [
    (Modality.BEACH_M, 6),
    (Modality.BEACH_F, 6),
    (Modality.INDOOR_M, 9),
    (Modality.INDOOR_F, 9),
]


async def ensure_squads(
    session: AsyncSession, club: Club, *, seeds: dict[Modality, int] | None = None
) -> None:
    """Garante elenco em todas as categorias (idempotente por modalidade).

    `seeds` (opcional) fixa a geração — usado no seed de dev para reprodutibilidade.
    Em produção, omitido: cada jogador recebe um elenco aleatório.
    """
    service = AthleteService(AthleteRepository(session))
    for modality, count in _STARTER_SQUADS:
        existing = await session.scalar(
            select(func.count())
            .select_from(Athlete)
            .where(Athlete.club_id == club.id, Athlete.modality == modality.value)
        )
        if not existing:
            await service.generate(
                modality=modality,
                count=count,
                club_id=club.id,
                seed=(seeds or {}).get(modality),
            )


async def ensure_player_setup(
    session: AsyncSession, owner_id: uuid.UUID, *, club_name: str = "Meu Clube"
) -> tuple[Club, bool]:
    """Garante carteira + clube + elenco inicial do jogador.

    Devolve (clube, created) onde `created` indica se o clube foi criado agora.
    """
    repo = UserRepository(session)
    await repo.get_or_create_state(owner_id)

    club = await repo.get_main_club(owner_id)
    created = False
    if club is None:
        club = Club(
            id=uuid.uuid4(),
            owner_id=owner_id,
            name=club_name,
            short_name="MCL",
            country="BRA",
            city="Vitória",
            modality=Modality.BEACH_M.value,
            reputation=55,
            fanbase=1000,
            is_cpu=False,
        )
        session.add(club)
        await session.flush()
        created = True

    await ensure_squads(session, club)
    # Remove atletas cuja validade (contratação por anúncio) expirou.
    from app.services.market_service import expire_due
    await expire_due(session, club_id=club.id)
    return club, created
