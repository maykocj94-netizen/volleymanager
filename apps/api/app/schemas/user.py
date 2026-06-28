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
    online_wins: int = 0
    online_losses: int = 0
    approved: bool = True
    lineup: Lineup
    club_id: uuid.UUID | None = None
    club_name: str | None = None
    club_city: str | None = None


class LoginResult(BaseModel):
    state: UserStateOut
    bonus_awarded: bool
    bonus_amount: int = 0


class ClubUpdate(BaseModel):
    """Personalização da conta: nome do clube e cidade."""

    name: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=60)


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


class ExchangeRequest(BaseModel):
    """Câmbio de moedas na Loja (1 ouro = 10 prata)."""

    direction: Literal["to_silver", "to_gold"]
    # to_silver: 'amount' = ouro a gastar. to_gold: 'amount' = prata a converter.
    amount: int = Field(ge=1)


class ExchangeResult(BaseModel):
    state: UserStateOut
    silver_delta: int
    gold_delta: int


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
    cpu_team: str | None = None      # nome do time (quadra), em vez dos 6 nomes
    free_rerolls_left: int
    reroll_cost: int


class CpuInfoOut(BaseModel):
    names: list[str]
    team_name: str | None = None
    tier: str
    label: str
    tactic: Tactic
    weather: Weather | None = None
    gold_awarded: int = 0
    statuses: dict[str, str] = Field(default_factory=dict)


class TimeoutEntry(BaseModel):
    """Pedido de tempo: a partir deste rally (deste set) muda a tática do mandante."""

    set_no: int = Field(ge=1)
    rally_no: int = Field(ge=1)
    tactic: Tactic


class MatchSimRequest(BaseModel):
    kind: Literal["beach", "indoor"] = "beach"
    sex: Sex = Sex.MALE
    home_tactic: Tactic = Tactic.BALANCED
    timeline: list[TimeoutEntry] = Field(default_factory=list)


class MatchSimResult(BaseModel):
    result: MatchResultOut
    cpu: CpuInfoOut


class MatchFinishResult(BaseModel):
    cpu: CpuInfoOut
    state: UserStateOut


class TrainRequest(BaseModel):
    athlete_id: uuid.UUID
    training: str


class TrainResult(BaseModel):
    athlete: AthleteOut
