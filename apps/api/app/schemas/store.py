"""Schemas: Loja (produtos do dono) e Centro de Treinamento (CT)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserStateOut

Currency = Literal["silver", "gold"]
CtKind = Literal["beach", "indoor"]


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    item_type: str
    quantity: int
    price_silver: int
    price_gold: int
    image_url: str | None = None
    active: bool
    # Enriquecidos a partir do catálogo (engine/ct.py).
    item_label: str = ""
    item_emoji: str = ""


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=240)
    item_type: str
    quantity: int = Field(default=1, ge=1, le=999)
    price_silver: int = Field(default=0, ge=0, le=100_000_000)
    price_gold: int = Field(default=0, ge=0, le=1_000_000)
    image_url: str | None = Field(default=None, max_length=400)
    active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=240)
    item_type: str | None = None
    quantity: int | None = Field(default=None, ge=1, le=999)
    price_silver: int | None = Field(default=None, ge=0, le=100_000_000)
    price_gold: int | None = Field(default=None, ge=0, le=1_000_000)
    image_url: str | None = Field(default=None, max_length=400)
    active: bool | None = None


class BuyRequest(BaseModel):
    product_id: uuid.UUID
    currency: Currency = "silver"


class InventoryItemOut(BaseModel):
    item_type: str
    label: str
    emoji: str
    quantity: int


class BuyResult(BaseModel):
    state: UserStateOut
    inventory: list[InventoryItemOut]
    granted_item: str
    granted_qty: int


# --- Centro de Treinamento -------------------------------------------------
class RequirementOut(BaseModel):
    item_type: str
    label: str
    emoji: str
    required: int
    owned: int
    ok: bool


class CenterOut(BaseModel):
    kind: CtKind
    label: str
    built: bool
    built_at: datetime | None = None
    requirements: list[RequirementOut]
    can_build: bool


class BuildResult(BaseModel):
    center: CenterOut
    centers: list[CenterOut]
    inventory: list[InventoryItemOut]
    message: str
