"""Controller: clubes."""

import uuid

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.models.club import Club
from app.repositories.club_repo import ClubRepository
from app.schemas.club import ClubCreate, ClubOut

router = APIRouter(prefix="/clubs", tags=["clubs"])


@router.post("", response_model=ClubOut, status_code=201)
async def create_club(
    body: ClubCreate,
    session: DbSession,
    user: CurrentUser,
) -> ClubOut:
    repo = ClubRepository(session)
    club = Club(
        id=uuid.uuid4(),
        owner_id=uuid.UUID(user.id),
        name=body.name,
        short_name=body.short_name,
        country=body.country,
        city=body.city,
        modality=body.modality.value,
    )
    repo.add(club)
    await repo.flush()
    return ClubOut.model_validate(club)


@router.get("/mine", response_model=list[ClubOut])
async def list_my_clubs(session: DbSession, user: CurrentUser) -> list[ClubOut]:
    repo = ClubRepository(session)
    clubs = await repo.list_by_owner(uuid.UUID(user.id))
    return [ClubOut.model_validate(c) for c in clubs]
