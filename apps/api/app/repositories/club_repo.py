"""Acesso a dados de clubes."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.club import Club


class ClubRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, club_id: uuid.UUID) -> Club | None:
        return await self.session.get(Club, club_id)

    async def list_by_owner(self, owner_id: uuid.UUID) -> list[Club]:
        stmt = select(Club).where(Club.owner_id == owner_id)
        result = await self.session.execute(stmt)
        return list(result.unique().scalars().all())

    def add(self, club: Club) -> None:
        self.session.add(club)

    async def flush(self) -> None:
        await self.session.flush()
