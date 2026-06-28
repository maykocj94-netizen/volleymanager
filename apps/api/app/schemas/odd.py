"""Schemas: sistema de Odds (apostas com multiplicador)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserStateOut

Selection = Literal["a", "b"]
Currency = Literal["silver", "gold"]


class OddOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    type: str
    description: str | None = None
    team_a_name: str
    team_a_odd: float
    team_b_name: str
    team_b_odd: float
    status: str
    winner: str | None = None
    # Agregados (preenchidos pelo serviço).
    bet_count: int = 0
    my_bets: list["OddBetOut"] = []


class OddCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    type: Literal["vitoria"] = "vitoria"
    description: str | None = Field(default=None, max_length=240)
    team_a_name: str = Field(min_length=1, max_length=60)
    team_a_odd: float = Field(ge=1.0, le=1000.0)
    team_b_name: str = Field(min_length=1, max_length=60)
    team_b_odd: float = Field(ge=1.0, le=1000.0)


class OddUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=240)
    team_a_name: str | None = Field(default=None, min_length=1, max_length=60)
    team_a_odd: float | None = Field(default=None, ge=1.0, le=1000.0)
    team_b_name: str | None = Field(default=None, min_length=1, max_length=60)
    team_b_odd: float | None = Field(default=None, ge=1.0, le=1000.0)


class SettleRequest(BaseModel):
    winner: Selection


class PlaceBetRequest(BaseModel):
    odd_id: uuid.UUID
    selection: Selection
    currency: Currency = "silver"
    amount: int = Field(ge=1, le=100_000_000)


class OddBetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    odd_id: uuid.UUID
    selection: str
    currency: str
    amount: int
    odd_value: float
    status: str
    payout: int
    # Contexto da Odd (para a tela "minhas apostas").
    odd_title: str = ""
    team_a_name: str = ""
    team_b_name: str = ""
    odd_status: str = ""
    odd_winner: str | None = None


class PlaceBetResult(BaseModel):
    state: UserStateOut
    bet: OddBetOut


# Admin: resumo de uma aposta de usuário numa Odd.
class OddBetAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    selection: str
    currency: str
    amount: int
    odd_value: float
    status: str
    payout: int


class OddAdminDetailOut(BaseModel):
    odd: OddOut
    bets: list[OddBetAdminOut]


# Resolve a referência adiantada (OddOut.my_bets -> OddBetOut).
OddOut.model_rebuild()
