"""Acesso a dados do estado do jogador."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.club import Club
from app.models.user_state import (
    STARTING_GOLD,
    STARTING_SILVER,
    UserState,
)


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_state(self, user_id: uuid.UUID) -> UserState | None:
        return await self.session.get(UserState, user_id)

    async def get_or_create_state(self, user_id: uuid.UUID) -> UserState:
        state = await self.session.get(UserState, user_id)
        if state is None:
            state = UserState(
                user_id=user_id,
                silver=STARTING_SILVER,
                gold=STARTING_GOLD,
                streak=0,
                lineup={},
                # Em dev (sem auth) a conta já entra liberada; contas reais novas
                # ficam pendentes de aprovação do dono.
                approved=settings.dev_no_auth,
            )
            self.session.add(state)
            await self.session.flush()
        return state

    async def get_main_club(self, user_id: uuid.UUID) -> Club | None:
        stmt = (
            select(Club)
            .where(Club.owner_id == user_id, Club.is_cpu.is_(False))
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()
