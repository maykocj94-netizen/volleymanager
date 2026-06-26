"""Schemas Pydantic (DTOs) para clubes."""

import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.enums import Modality


class ClubOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID | None
    name: str
    short_name: str | None
    crest_url: str | None
    country: str
    city: str | None
    modality: Modality
    reputation: int
    fanbase: int
    is_cpu: bool


class ClubCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    short_name: str | None = Field(default=None, max_length=8)
    country: str = "BRA"
    city: str | None = None
    modality: Modality
