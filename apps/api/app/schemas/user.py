"""Schemas Pydantic para estado do jogador (carteira, login, escalação)."""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.enums import Modality, Sex, Tactic, Weather
from app.schemas.athlete import AthleteOut
from app.schemas.match import MatchResultOut


class Lineup(BaseModel):
    """Escalações salvas por categoria (disciplina × sexo)."""

    beach_m: list[uuid.UUID] = Field(default_factory=list)   # dupla masculina
    beach_f: list[uuid.UUID] = Field(default_factory=list)   # dupla feminina
    indoor_m: list[uuid.UUID] = Field(default_factory=list)  # sexteto masculino
    indoor_f: list[uuid.UUID] = Field(default_factory=list)  # sexteto feminino


class UserStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    silver: int
    gold: int
    streak: int
    last_login: date | None
    matches_played: int = 0
    matches_won: int = 0
    matches_lost: int = 0
    lineup: Lineup
    club_id: uuid.UUID | None = None


class LoginResult(BaseModel):
    state: UserStateOut
    bonus_awarded: bool
    bonus_amount: int = 0


class HireRequest(BaseModel):
    modality: Modality = Modality.BEACH_M


class HireResult(BaseModel):
    athlete: AthleteOut
    state: UserStateOut


class MatchResultReport(BaseModel):
    """Resultado de uma partida do jogador, reportado pelo cliente ao final."""

    won: bool
    athlete_ids: list[uuid.UUID] = Field(default_factory=list)


class SellResult(BaseModel):
    value: int
    state: UserStateOut


class AthleteIdRequest(BaseModel):
    athlete_id: uuid.UUID


class SignResult(BaseModel):
    athlete: AthleteOut
    state: UserStateOut


# --- Cenário da partida (CPU) ---------------------------------------------
class ScenarioOut(BaseModel):
    tier: str
    label: str
    tactic: Tactic
    weather: Weather
    cpu_names: list[str]
    free_rerolls_left: int
    reroll_cost: int


class CpuInfoOut(BaseModel):
    names: list[str]
    tier: str
    label: str
    tactic: Tactic
    weather: Weather | None = None


class MatchStartRequest(BaseModel):
    kind: Literal["beach", "indoor"] = "beach"
    sex: Sex = Sex.MALE
    home_tactic: Tactic = Tactic.BALANCED


class MatchStartResult(BaseModel):
    result: MatchResultOut
    cpu: CpuInfoOut
    state: UserStateOut
