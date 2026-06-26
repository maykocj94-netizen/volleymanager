"""Central de contas: operações administrativas sobre usuários e atletas."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import Modality
from app.models.athlete import Athlete
from app.models.club import Club
from app.models.user_state import UserState
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.athlete_service import AthleteService
from app.services.user_service import NotFound


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _club_of(self, user_id: uuid.UUID) -> Club | None:
        return await UserRepository(self.session).get_main_club(user_id)

    async def list_users(self) -> list[dict]:
        states = (await self.session.execute(select(UserState))).scalars().all()
        rows: list[dict] = []
        for st in states:
            club = await self._club_of(st.user_id)
            count = 0
            if club is not None:
                count = await self.session.scalar(
                    select(func.count()).select_from(Athlete).where(Athlete.club_id == club.id)
                ) or 0
            rows.append({
                "user_id": st.user_id,
                "club_id": club.id if club else None,
                "club_name": club.name if club else None,
                "silver": st.silver,
                "gold": st.gold,
                "streak": st.streak,
                "matches_played": st.matches_played,
                "matches_won": st.matches_won,
                "matches_lost": st.matches_lost,
                "athlete_count": int(count),
            })
        return rows

    async def list_user_athletes(self, user_id: uuid.UUID) -> list[Athlete]:
        club = await self._club_of(user_id)
        if club is None:
            return []
        return await AthleteRepository(self.session).list_by_club(club.id)

    async def patch_athlete(self, athlete_id: uuid.UUID, data: dict) -> Athlete:
        repo = AthleteRepository(self.session)
        athlete = await repo.get(athlete_id)
        if athlete is None:
            raise NotFound("Atleta não encontrado.")
        attrs = data.pop("attributes", None)
        for key, value in data.items():
            if value is not None:
                setattr(athlete, key, value)
        if attrs and athlete.attributes is not None:
            for key, value in attrs.items():
                if value is not None:
                    setattr(athlete.attributes, key, value)
        return athlete

    async def add_athlete(self, user_id: uuid.UUID, modality: Modality) -> Athlete:
        club = await self._club_of(user_id)
        service = AthleteService(AthleteRepository(self.session))
        athletes = await service.generate(
            modality=modality, count=1, club_id=club.id if club else None
        )
        return athletes[0]

    async def remove_athlete(self, athlete_id: uuid.UUID) -> None:
        repo = AthleteRepository(self.session)
        athlete = await repo.get(athlete_id)
        if athlete is None:
            raise NotFound("Atleta não encontrado.")
        await repo.delete(athlete)

    async def adjust_coins(
        self, user_id: uuid.UUID, silver_delta: int, gold_delta: int
    ) -> UserState:
        state = await UserRepository(self.session).get_or_create_state(user_id)
        state.silver = max(0, state.silver + silver_delta)
        state.gold = max(0, state.gold + gold_delta)
        return state
