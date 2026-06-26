"""Schemas: marketplace de contratações (anúncios) e vendas com aprovação."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.enums import BeachPosition, CourtPosition, Modality, Sex
from app.schemas.athlete import AthleteOut, AttributesIn
from app.schemas.user import UserStateOut


class HireListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    country: str
    sex: Sex
    modality: Modality
    court_position: CourtPosition | None
    beach_position: BeachPosition | None
    height_cm: int
    weight_kg: int
    attributes: dict
    current_ability: int
    potential_ability: int
    price: int
    availability_days: int
    status: str
    hired_by: uuid.UUID | None = None
    expires_at: datetime | None = None


class HireListingCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=40)
    last_name: str = Field(min_length=1, max_length=40)
    country: str = "BRA"
    sex: Sex
    modality: Modality
    court_position: CourtPosition | None = None
    beach_position: BeachPosition | None = None
    height_cm: int = Field(default=190, ge=140, le=230)
    weight_kg: int = Field(default=85, ge=40, le=160)
    attributes: AttributesIn = Field(default_factory=AttributesIn)
    price: int = Field(default=1000, ge=0, le=1_000_000)
    availability_days: int = Field(default=30, ge=1, le=3650)
    potential_bonus: int = Field(default=5, ge=0, le=40)


class HireListingUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    country: str | None = None
    height_cm: int | None = Field(default=None, ge=140, le=230)
    weight_kg: int | None = Field(default=None, ge=40, le=160)
    attributes: AttributesIn | None = None
    price: int | None = Field(default=None, ge=0, le=1_000_000)
    availability_days: int | None = Field(default=None, ge=1, le=3650)


class HireListingRequest(BaseModel):
    listing_id: uuid.UUID


class HireListingResult(BaseModel):
    athlete: AthleteOut
    state: UserStateOut


class ListForSaleRequest(BaseModel):
    athlete_id: uuid.UUID


class SaleRequestOut(BaseModel):
    id: uuid.UUID
    athlete_id: uuid.UUID
    seller_id: uuid.UUID
    price: int
    status: str
    athlete_name: str = "—"
    current_ability: int = 0
