"""Schemas Pydantic (DTOs) para atletas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.enums import BeachPosition, CourtPosition, Handedness, Modality, Sex


class AttributesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    serve: int
    attack: int
    block: int
    defense: int
    reception: int
    setting: int
    speed: int
    jump: int
    stamina: int
    positioning: int
    decision: int
    concentration: int
    competitiveness: int


class AthleteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    club_id: uuid.UUID | None
    first_name: str
    last_name: str
    country: str
    city: str | None
    birth_date: date
    height_cm: int
    weight_kg: int
    handedness: Handedness
    sex: Sex
    modality: Modality
    court_position: CourtPosition | None
    beach_position: BeachPosition | None
    current_ability: int
    potential_ability: int
    morale: int
    fatigue: int
    form: int
    market_value: int
    sale_value: int
    wins: int
    losses: int
    is_custom: bool
    is_injured: bool
    # Progressão e condição física.
    level: int = 1
    level_xp: int = 0
    condition: str = "ok"            # "ok" | "fatigued" | "injured"
    rest_games_left: int = 0
    injured_until: datetime | None = None
    last_trained_on: date | None = None
    for_sale: bool = False
    expires_at: datetime | None = None
    listing_id: uuid.UUID | None = None  # veio de um anúncio (não vende, não treina)
    attributes: AttributesOut | None = None


class AthleteCreate(BaseModel):
    first_name: str
    last_name: str
    country: str = "BRA"
    city: str | None = None
    birth_date: date
    height_cm: int = Field(ge=140, le=230)
    weight_kg: int = Field(ge=40, le=160)
    handedness: Handedness = Handedness.RIGHT
    modality: Modality
    court_position: CourtPosition | None = None
    beach_position: BeachPosition | None = None
    club_id: uuid.UUID | None = None


class GenerateRequest(BaseModel):
    modality: Modality
    count: int = Field(default=10, ge=1, le=200)
    country: str | None = None
    seed: int | None = None
    club_id: uuid.UUID | None = None  # se nulo, gera agentes livres


class AttributesIn(BaseModel):
    serve: int = Field(default=50, ge=1, le=99)
    attack: int = Field(default=50, ge=1, le=99)
    block: int = Field(default=50, ge=1, le=99)
    defense: int = Field(default=50, ge=1, le=99)
    reception: int = Field(default=50, ge=1, le=99)
    setting: int = Field(default=50, ge=1, le=99)
    speed: int = Field(default=50, ge=1, le=99)
    jump: int = Field(default=50, ge=1, le=99)
    stamina: int = Field(default=50, ge=1, le=99)
    positioning: int = Field(default=50, ge=1, le=99)
    decision: int = Field(default=50, ge=1, le=99)
    concentration: int = Field(default=50, ge=1, le=99)
    competitiveness: int = Field(default=50, ge=1, le=99)


class CustomAthleteCreate(BaseModel):
    """Atleta personalizado criado pelo jogador (Mercado → Contratações)."""

    first_name: str = Field(min_length=1, max_length=40)
    last_name: str = Field(min_length=1, max_length=40)
    country: str = "BRA"
    sex: Sex
    modality: Modality
    court_position: CourtPosition | None = None
    beach_position: BeachPosition | None = None
    height_cm: int = Field(default=190, ge=140, le=230)
    weight_kg: int = Field(default=85, ge=40, le=160)
    birth_date: date | None = None
    attributes: AttributesIn = Field(default_factory=AttributesIn)
