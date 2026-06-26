"""Marketplace de contratações (anúncios do dono) + expiração de atletas.

- O dono publica anúncios (`HireListing`); os jogadores os veem em Contratações.
- Contratar é único: ao contratar, o anúncio sai do ar para os demais e cria um
  atleta no clube do jogador, com validade (dias reais).
- Ao expirar, o atleta some da biblioteca e o anúncio vira "expired" (o dono pode
  editar e republicar).
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.generation import _ALL_ATTRS
from app.models.athlete import Athlete, AthleteAttributes
from app.models.hire_listing import HireListing
from app.repositories.user_repo import UserRepository
from app.services.user_service import InsufficientFunds, NotFound


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def expire_due(
    session: AsyncSession, *, now: datetime | None = None, club_id: uuid.UUID | None = None
) -> int:
    """Remove atletas expirados (validade do anúncio) e marca os anúncios.

    Se `club_id` for dado, limita-se ao clube (uso comum no /me). Devolve quantos
    atletas expiraram.
    """
    now = now or datetime.now(timezone.utc)
    stmt = select(Athlete).where(Athlete.expires_at.is_not(None))
    if club_id is not None:
        stmt = stmt.where(Athlete.club_id == club_id)
    candidates = (await session.execute(stmt)).unique().scalars().all()
    expired = 0
    for athlete in candidates:
        if athlete.expires_at is None or _aware(athlete.expires_at) > now:
            continue
        if athlete.listing_id is not None:
            listing = await session.get(HireListing, athlete.listing_id)
            if listing is not None and listing.status != "expired":
                listing.status = "expired"
                listing.athlete_id = None
        await session.delete(athlete)
        expired += 1
    return expired


class MarketplaceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_published(self) -> list[HireListing]:
        stmt = (
            select(HireListing)
            .where(HireListing.status == "published")
            .order_by(HireListing.created_at.desc())
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def hire(self, user_id: uuid.UUID, listing_id: uuid.UUID) -> tuple[Athlete, "object"]:
        repo = UserRepository(self.session)
        state = await repo.get_or_create_state(user_id)
        listing = await self.session.get(HireListing, listing_id)
        if listing is None or listing.status != "published":
            raise NotFound("Anúncio indisponível (já contratado ou removido).")
        if state.silver < listing.price:
            raise InsufficientFunds(
                f"Precisa de {listing.price} de prata (tem {state.silver})."
            )
        club = await repo.get_main_club(user_id)
        now = datetime.now(timezone.utc)
        expires = now + timedelta(days=listing.availability_days)

        athlete = Athlete(
            id=uuid.uuid4(),
            club_id=club.id if club else None,
            first_name=listing.first_name,
            last_name=listing.last_name,
            country=listing.country,
            birth_date=date(datetime.now().year - 24, 1, 1),
            height_cm=listing.height_cm,
            weight_kg=listing.weight_kg,
            handedness="right",
            sex=listing.sex,
            modality=listing.modality,
            court_position=listing.court_position,
            beach_position=listing.beach_position,
            current_ability=listing.current_ability,
            potential_ability=listing.potential_ability,
            listing_id=listing.id,
            expires_at=expires,
        )
        attrs = AthleteAttributes(
            athlete_id=athlete.id,
            **{a: int((listing.attributes or {}).get(a, 50)) for a in _ALL_ATTRS},
        )
        athlete.attributes = attrs
        athlete.market_value = athlete.sale_value
        self.session.add(athlete)
        self.session.add(attrs)

        state.silver -= listing.price
        listing.status = "hired"
        listing.hired_by = user_id
        listing.hired_at = now
        listing.expires_at = expires
        listing.athlete_id = athlete.id
        await self.session.flush()
        return athlete, state
