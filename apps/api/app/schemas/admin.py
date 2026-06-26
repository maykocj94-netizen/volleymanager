"""Schemas da central de contas (admin)."""

import uuid

from pydantic import BaseModel, Field

from app.enums import Modality
from app.schemas.athlete import AthleteOut


class AdminUser(BaseModel):
    user_id: uuid.UUID
    club_id: uuid.UUID | None = None
    club_name: str | None = None
    silver: int
    gold: int
    streak: int
    matches_played: int
    matches_won: int
    matches_lost: int
    athlete_count: int
    approved: bool = True


class ApproveRequest(BaseModel):
    approved: bool = True


class CoinAdjust(BaseModel):
    """Deltas de moedas (podem ser negativos para remover)."""

    silver_delta: int = 0
    gold_delta: int = 0


class AdminWallet(BaseModel):
    user_id: uuid.UUID
    silver: int
    gold: int


class AttributesPatch(BaseModel):
    serve: int | None = Field(default=None, ge=0, le=100)
    attack: int | None = Field(default=None, ge=0, le=100)
    block: int | None = Field(default=None, ge=0, le=100)
    defense: int | None = Field(default=None, ge=0, le=100)
    reception: int | None = Field(default=None, ge=0, le=100)
    setting: int | None = Field(default=None, ge=0, le=100)
    speed: int | None = Field(default=None, ge=0, le=100)
    jump: int | None = Field(default=None, ge=0, le=100)
    stamina: int | None = Field(default=None, ge=0, le=100)
    positioning: int | None = Field(default=None, ge=0, le=100)
    decision: int | None = Field(default=None, ge=0, le=100)
    concentration: int | None = Field(default=None, ge=0, le=100)
    competitiveness: int | None = Field(default=None, ge=0, le=100)


class AthletePatch(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    current_ability: int | None = Field(default=None, ge=0, le=100)
    potential_ability: int | None = Field(default=None, ge=0, le=100)
    morale: int | None = Field(default=None, ge=0, le=100)
    fatigue: int | None = Field(default=None, ge=0, le=100)
    form: int | None = Field(default=None, ge=0, le=100)
    market_value: int | None = Field(default=None, ge=0)
    is_injured: bool | None = None
    attributes: AttributesPatch | None = None


class AdminAddAthlete(BaseModel):
    modality: Modality = Modality.BEACH_M


class AdminAthleteResult(BaseModel):
    athlete: AthleteOut
