"""Schemas: sistema de Odds (apostas com multiplicador)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserStateOut

Currency = Literal["silver", "gold"]


class OddOption(BaseModel):
    key: str
    label: str
    odd: float


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
    options: list[OddOption] = []
    status: str
    winner: str | None = None
    closes_at: datetime | None = None
    betting_open: bool = True
    # Agregados (preenchidos pelo serviço).
    bet_count: int = 0
    my_bets: list["OddBetOut"] = []


class OddCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    type: Literal["vitoria", "placar"] = "vitoria"
    description: str | None = Field(default=None, max_length=240)
    # Tipo "vitoria": confronto Time A x Time B.
    team_a_name: str | None = Field(default=None, max_length=60)
    team_a_odd: float | None = Field(default=None, ge=1.0, le=1000.0)
    team_b_name: str | None = Field(default=None, max_length=60)
    team_b_odd: float | None = Field(default=None, ge=1.0, le=1000.0)
    # Tipo "placar": 1 multiplicador comum + alternativas.
    multiplier: float | None = Field(default=None, ge=1.0, le=1000.0)
    alternatives: list[str] | None = None
    # Prazo para apostar (opcional). Após isso, ninguém mais aposta.
    closes_at: datetime | None = None


class OddUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=240)
    team_a_name: str | None = Field(default=None, min_length=1, max_length=60)
    team_a_odd: float | None = Field(default=None, ge=1.0, le=1000.0)
    team_b_name: str | None = Field(default=None, min_length=1, max_length=60)
    team_b_odd: float | None = Field(default=None, ge=1.0, le=1000.0)
    multiplier: float | None = Field(default=None, ge=1.0, le=1000.0)
    alternatives: list[str] | None = None
    closes_at: datetime | None = None


class SettleRequest(BaseModel):
    winner: str = Field(min_length=1, max_length=20)


class PlaceBetRequest(BaseModel):
    odd_id: uuid.UUID
    selection: str = Field(min_length=1, max_length=20)
    currency: Currency = "silver"
    amount: int = Field(ge=1, le=100_000_000)


class OddBetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    odd_id: uuid.UUID
    selection: str
    selection_label: str = ""
    currency: str
    amount: int
    odd_value: float
    status: str
    payout: int
    # Contexto da Odd (para a tela "minhas apostas" / histórico).
    odd_title: str = ""
    odd_type: str = ""
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
    team_name: str = ""
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
