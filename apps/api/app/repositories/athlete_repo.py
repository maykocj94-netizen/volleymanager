"""Acesso a dados de atletas (sem regra de negócio)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import Athlete, AthleteAttributes


class AthleteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, athlete_id: uuid.UUID) -> Athlete | None:
        return await self.session.get(Athlete, athlete_id)

    async def list_by_club(self, club_id: uuid.UUID) -> list[Athlete]:
        stmt = select(Athlete).where(Athlete.club_id == club_id)
        result = await self.session.execute(stmt)
        return list(result.unique().scalars().all())

    async def list_free_agents(self, modality: str, limit: int = 50) -> list[Athlete]:
        stmt = (
            select(Athlete)
            .where(Athlete.club_id.is_(None), Athlete.modality == modality)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.unique().scalars().all())

    async def list_custom_available(self, limit: int = 100) -> list[Athlete]:
        """Atletas personalizados ainda sem clube (disponíveis em Contratações)."""
        stmt = (
            select(Athlete)
            .where(Athlete.is_custom.is_(True), Athlete.club_id.is_(None))
            .order_by(Athlete.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.unique().scalars().all())

    def add(self, athlete: Athlete, attributes: AthleteAttributes) -> None:
        self.session.add(athlete)
        self.session.add(attributes)

    async def delete(self, athlete: Athlete) -> None:
        await self.session.delete(athlete)

    async def flush(self) -> None:
        await self.session.flush()
