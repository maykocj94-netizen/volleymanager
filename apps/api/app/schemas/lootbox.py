"""Schemas: Lootbox (caixas de recompensa)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.enums import BeachPosition, CourtPosition, Modality, Sex
from app.schemas.athlete import AthleteOut, AttributesIn
from app.schemas.user import UserStateOut

Currency = Literal["silver", "gold"]
Rarity = Literal["comum", "raro", "super_raro", "lendario"]
ItemKind = Literal["revelation", "listing", "custom"]


class LootboxOut(BaseModel):
    id: uuid.UUID
    name: str
    rarity: str
    description: str | None = None
    image_url: str | None = None
    cost_currency: str
    cost_amount: int
    item_count: int = 0
    available_count: int = 0
    active: bool = True


class LootboxCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    rarity: Rarity = "comum"
    description: str | None = Field(default=None, max_length=240)
    image_url: str | None = Field(default=None, max_length=400)
    cost_currency: Currency = "silver"
    cost_amount: int = Field(default=100, ge=0, le=100_000_000)
    active: bool = True


class LootboxUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    rarity: Rarity | None = None
    description: str | None = Field(default=None, max_length=240)
    image_url: str | None = Field(default=None, max_length=400)
    cost_currency: Currency | None = None
    cost_amount: int | None = Field(default=None, ge=0, le=100_000_000)
    active: bool | None = None


class LootboxItemOut(BaseModel):
    id: uuid.UUID
    kind: str
    probability: float
    label: str
    listing_id: uuid.UUID | None = None
    claimed: bool = False
    current_ability: int = 0


class LootboxDetailOut(BaseModel):
    box: LootboxOut
    items: list[LootboxItemOut]


class AddItemRequest(BaseModel):
    kind: ItemKind
    probability: float = Field(default=10.0, ge=0, le=100)
    # revelation
    modality: Modality | None = None
    # listing
    listing_id: uuid.UUID | None = None
    # custom
    first_name: str | None = Field(default=None, max_length=40)
    last_name: str | None = Field(default=None, max_length=40)
    country: str | None = "BRA"
    sex: Sex | None = None
    court_position: CourtPosition | None = None
    beach_position: BeachPosition | None = None
    age: int | None = Field(default=24, ge=15, le=50)
    height_cm: int | None = Field(default=190, ge=140, le=230)
    weight_kg: int | None = Field(default=85, ge=40, le=160)
    attributes: AttributesIn | None = None
    potential_bonus: int = Field(default=5, ge=0, le=40)


class UpdateItemRequest(BaseModel):
    probability: float = Field(ge=0, le=100)


# ---- visão do usuário -----------------------------------------------------
class LootboxInfoListing(BaseModel):
    item_id: uuid.UUID
    name: str
    current_ability: int
    potential_ability: int
    sex: str
    age: int
    court_position: str | None = None
    beach_position: str | None = None
    attributes: dict = {}
    probability: float
    claimed: bool


class LootboxInfoOut(BaseModel):
    id: uuid.UUID
    name: str
    rarity: str
    description: str | None = None
    cost_currency: str
    cost_amount: int
    revelation_count: int
    custom_count: int
    listings: list[LootboxInfoListing]


class SpinWon(BaseModel):
    kind: str
    label: str


class SpinResult(BaseModel):
    state: UserStateOut
    athlete: AthleteOut
    won: SpinWon
