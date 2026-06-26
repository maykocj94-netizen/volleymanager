"""Controller: atletas."""

import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.enums import Modality
from app.repositories.athlete_repo import AthleteRepository
from app.schemas.athlete import AthleteOut, CustomAthleteCreate, GenerateRequest
from app.services.athlete_service import AthleteService

router = APIRouter(prefix="/athletes", tags=["athletes"])


@router.post("/generate", response_model=list[AthleteOut])
async def generate_athletes(
    body: GenerateRequest,
    session: DbSession,
    _user: CurrentUser,
) -> list[AthleteOut]:
    """Gera atletas proceduralmente (determinístico se `seed` for informado)."""
    service = AthleteService(AthleteRepository(session))
    athletes = await service.generate(
        modality=body.modality,
        count=body.count,
        country=body.country or "BRA",
        seed=body.seed,
        club_id=body.club_id,
    )
    return [AthleteOut.model_validate(a) for a in athletes]


@router.get("/club/{club_id}", response_model=list[AthleteOut])
async def list_club_athletes(
    club_id: uuid.UUID,
    session: DbSession,
    _user: CurrentUser,
) -> list[AthleteOut]:
    # Remove atletas com validade expirada (contratações por anúncio) antes de listar.
    from app.services.market_service import expire_due
    await expire_due(session, club_id=club_id)
    service = AthleteService(AthleteRepository(session))
    athletes = await service.list_by_club(club_id)
    return [AthleteOut.model_validate(a) for a in athletes]


@router.get("/free", response_model=list[AthleteOut])
async def list_free_agents(
    session: DbSession,
    _user: CurrentUser,
    modality: Modality = Query(default=Modality.BEACH_M),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AthleteOut]:
    """Agentes livres disponíveis no mercado."""
    repo = AthleteRepository(session)
    athletes = await repo.list_free_agents(modality.value, limit=limit)
    return [AthleteOut.model_validate(a) for a in athletes]


@router.get("/custom", response_model=list[AthleteOut])
async def list_custom_athletes(session: DbSession, _user: CurrentUser) -> list[AthleteOut]:
    """Atletas personalizados disponíveis (Mercado → Contratações)."""
    repo = AthleteRepository(session)
    athletes = await repo.list_custom_available()
    return [AthleteOut.model_validate(a) for a in athletes]


@router.post("/custom", response_model=AthleteOut)
async def create_custom_athlete(
    body: CustomAthleteCreate, session: DbSession, _user: CurrentUser
) -> AthleteOut:
    """Cria um atleta personalizado, que passa a aparecer em Contratações."""
    service = AthleteService(AthleteRepository(session))
    birth = body.birth_date or date(date.today().year - 24, 1, 1)
    athlete = await service.create_custom(
        first_name=body.first_name,
        last_name=body.last_name,
        country=body.country,
        sex=body.sex,
        modality=body.modality,
        court_position=body.court_position,
        beach_position=body.beach_position,
        height_cm=body.height_cm,
        weight_kg=body.weight_kg,
        birth_date=birth,
        attributes=body.attributes.model_dump(),
    )
    return AthleteOut.model_validate(athlete)
