"""Fisioterapia: recuperação acelerada de fadiga/lesão (tempo real).

- Fadigado: 5 minutos na fisioterapia removem a fadiga.
- Lesionado: recupera em até 12 horas (ou menos, se a lesão já fosse curar antes).

A cura é preguiçosa: ao listar (ou no /me), os atletas cujo `physio_until` já
passou voltam a ficar "ok".
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import Athlete
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.user_service import NotFound

FATIGUE_PHYSIO_MINUTES = 5
INJURY_PHYSIO_MAX_HOURS = 12


class PhysioError(Exception):
    """Erro de regra da fisioterapia (atleta apto, já em recuperação, etc.)."""


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _heal(a: Athlete) -> None:
    a.condition = "ok"
    a.is_injured = False
    a.injured_until = None
    a.rest_games_left = 0
    a.games_since_rest = 0
    a.hard_streak = 0
    a.physio_started_at = None
    a.physio_until = None


async def sync_physio(
    session: AsyncSession, *, club_id: uuid.UUID | None = None, now: datetime | None = None
) -> int:
    """Cura os atletas cuja fisioterapia já terminou. Devolve quantos curou."""
    now = now or datetime.now(timezone.utc)
    stmt = select(Athlete).where(Athlete.physio_until.is_not(None))
    if club_id is not None:
        stmt = stmt.where(Athlete.club_id == club_id)
    rows = (await session.execute(stmt)).unique().scalars().all()
    healed = 0
    for a in rows:
        if a.physio_until is not None and _aware(a.physio_until) <= now:
            _heal(a)
            healed += 1
    return healed


class PhysioService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for(self, user_id: uuid.UUID) -> list[Athlete]:
        """Atletas fadigados/lesionados ou já em recuperação no clube do jogador."""
        club = await UserRepository(self.session).get_main_club(user_id)
        if club is None:
            return []
        await sync_physio(self.session, club_id=club.id)
        athletes = await AthleteRepository(self.session).list_by_club(club.id)
        return [
            a for a in athletes
            if a.physio_until is not None or a.condition in ("fatigued", "injured")
        ]

    async def start(self, user_id: uuid.UUID, athlete_id: uuid.UUID) -> Athlete:
        club = await UserRepository(self.session).get_main_club(user_id)
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or club is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        if athlete.physio_until is not None:
            raise PhysioError("Este atleta já está em fisioterapia.")
        if athlete.condition not in ("fatigued", "injured"):
            raise PhysioError("Só atletas fadigados ou lesionados fazem fisioterapia.")
        now = datetime.now(timezone.utc)
        athlete.physio_started_at = now
        if athlete.condition == "fatigued":
            athlete.physio_until = now + timedelta(minutes=FATIGUE_PHYSIO_MINUTES)
        else:  # injured
            cap = now + timedelta(hours=INJURY_PHYSIO_MAX_HOURS)
            natural = _aware(athlete.injured_until) if athlete.injured_until else cap
            athlete.physio_until = min(cap, natural)
        await self.session.flush()
        return athlete

    async def cancel(self, user_id: uuid.UUID, athlete_id: uuid.UUID) -> Athlete:
        """Tira o atleta da fisioterapia (continua fadigado/lesionado)."""
        club = await UserRepository(self.session).get_main_club(user_id)
        athlete = await AthleteRepository(self.session).get(athlete_id)
        if athlete is None or club is None or athlete.club_id != club.id:
            raise NotFound("Atleta não encontrado no seu elenco.")
        athlete.physio_started_at = None
        athlete.physio_until = None
        await self.session.flush()
        return athlete
