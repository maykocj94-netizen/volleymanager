"""Central de contas: operações administrativas sobre usuários e atletas."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.generation import _ALL_ATTRS, _BEACH_WEIGHTS, _COURT_WEIGHTS
from app.enums import BeachPosition, CourtPosition, Modality
from app.models.athlete import Athlete
from app.models.club import Club
from app.models.hire_listing import HireListing
from app.models.user_state import UserState
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.athlete_service import AthleteService
from app.services.user_service import NotFound


def _ability_from(attrs: dict, court: str | None, beach: str | None) -> int:
    """Habilidade atual = média dos atributos ponderada pela posição."""
    weights: dict[str, float] = {}
    if court:
        weights = _COURT_WEIGHTS.get(CourtPosition(court), {})
    elif beach:
        weights = _BEACH_WEIGHTS.get(BeachPosition(beach), {})
    total_w = sum(weights.get(a, 0.5) for a in _ALL_ATTRS) or 1.0
    weighted = sum(int(attrs.get(a, 50)) * weights.get(a, 0.5) for a in _ALL_ATTRS)
    return max(25, min(99, round(weighted / total_w)))


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
                "email": st.email,
                "club_id": club.id if club else None,
                "club_name": club.name if club else None,
                "club_city": club.city if club else None,
                "silver": st.silver,
                "gold": st.gold,
                "streak": st.streak,
                "matches_played": st.matches_played,
                "matches_won": st.matches_won,
                "matches_lost": st.matches_lost,
                "online_wins": st.online_wins,
                "online_losses": st.online_losses,
                "athlete_count": int(count),
                "approved": bool(st.approved),
            })
        return rows

    async def set_approved(self, user_id: uuid.UUID, approved: bool) -> UserState:
        state = await UserRepository(self.session).get_or_create_state(user_id)
        state.approved = approved
        return state

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

    # -- anúncios de contratação (marketplace do dono) --------------------
    async def list_listings(self) -> list[HireListing]:
        stmt = select(HireListing).order_by(HireListing.created_at.desc())
        return list((await self.session.execute(stmt)).scalars().all())

    async def create_listing(self, data: dict) -> HireListing:
        attrs = {a: int(data.get("attributes", {}).get(a, 50)) for a in _ALL_ATTRS}
        current = _ability_from(attrs, data.get("court_position"), data.get("beach_position"))
        listing = HireListing(
            id=uuid.uuid4(),
            first_name=data["first_name"],
            last_name=data["last_name"],
            country=data.get("country", "BRA"),
            sex=data["sex"],
            modality=data["modality"],
            court_position=data.get("court_position"),
            beach_position=data.get("beach_position"),
            age=int(data.get("age", 24)),
            height_cm=int(data.get("height_cm", 190)),
            weight_kg=int(data.get("weight_kg", 85)),
            attributes=attrs,
            current_ability=current,
            potential_ability=max(current, min(99, current + int(data.get("potential_bonus", 5)))),
            price=int(data.get("price", 1000)),
            price_gold=int(data.get("price_gold", 0)),
            availability_days=int(data.get("availability_days", 30)),
            status="published",
        )
        self.session.add(listing)
        await self.session.flush()
        return listing

    async def update_listing(self, listing_id: uuid.UUID, data: dict) -> HireListing:
        listing = await self.session.get(HireListing, listing_id)
        if listing is None:
            raise NotFound("Anúncio não encontrado.")
        # Posições (incl. limpar para deixar de ser "ambos").
        if data.get("clear_court"):
            listing.court_position = None
        if data.get("clear_beach"):
            listing.beach_position = None
        for key in ("court_position", "beach_position"):
            if data.get(key) is not None:
                setattr(listing, key, data[key])
        for key in (
            "first_name", "last_name", "country", "sex", "modality",
            "age", "height_cm", "weight_kg", "price", "price_gold", "availability_days",
        ):
            if data.get(key) is not None:
                setattr(listing, key, data[key])
        if data.get("attributes") is not None:
            base = listing.attributes or {}
            attrs = {a: int(data["attributes"].get(a, base.get(a, 50))) for a in _ALL_ATTRS}
            listing.attributes = attrs
        # Recalcula a habilidade pela posição + atributos atuais.
        listing.current_ability = _ability_from(
            listing.attributes or {}, listing.court_position, listing.beach_position
        )
        listing.potential_ability = max(listing.potential_ability, listing.current_ability)
        return listing

    async def republish_listing(self, listing_id: uuid.UUID) -> HireListing:
        """Reabre um anúncio (ex.: após expirar) para nova contratação."""
        listing = await self.session.get(HireListing, listing_id)
        if listing is None:
            raise NotFound("Anúncio não encontrado.")
        listing.status = "published"
        listing.hired_by = None
        listing.hired_at = None
        listing.expires_at = None
        listing.athlete_id = None
        return listing

    async def delete_listing(self, listing_id: uuid.UUID) -> None:
        listing = await self.session.get(HireListing, listing_id)
        if listing is None:
            raise NotFound("Anúncio não encontrado.")
        await self.session.delete(listing)
