"""Schemas (DTOs) do módulo de Competições."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.athlete import AthleteOut


class TournamentOut(BaseModel):
    id: uuid.UUID
    title: str
    subtitle: str | None = None
    image_url: str | None = None
    type: str
    kind: str
    sex: str
    slots: int
    num_groups: int
    teams_per_group: int
    advance_per_group: int
    prize_silver_1: int
    prize_silver_2: int
    prize_silver_3: int
    prize_gold_1: int
    prize_gold_2: int
    prize_gold_3: int
    status: str
    entry_count: int
    team_size: int


class TournamentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    subtitle: str | None = Field(default=None, max_length=120)
    image_url: str | None = None
    type: Literal["round_robin", "knockout", "groups", "repechage"] = "round_robin"
    kind: Literal["beach", "indoor"] = "beach"
    sex: Literal["male", "female"] = "male"
    slots: int = Field(default=8, ge=2, le=64)
    num_groups: int = Field(default=2, ge=1, le=16)
    teams_per_group: int = Field(default=4, ge=2, le=16)
    advance_per_group: int = Field(default=2, ge=1, le=8)
    prize_silver_1: int = Field(default=0, ge=0)
    prize_silver_2: int = Field(default=0, ge=0)
    prize_silver_3: int = Field(default=0, ge=0)
    prize_gold_1: int = Field(default=0, ge=0)
    prize_gold_2: int = Field(default=0, ge=0)
    prize_gold_3: int = Field(default=0, ge=0)


class TournamentEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    team_name: str
    athlete_ids: list[str] = []
    group_no: int | None = None
    points: int
    wins: int
    losses: int
    sets_won: int
    sets_lost: int
    placement: int | None = None


class TournamentMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stage: str
    group_no: int | None = None
    round_no: int
    order: int
    entry_a_id: uuid.UUID | None = None
    entry_b_id: uuid.UUID | None = None
    a_name: str
    b_name: str
    score_a: int | None = None
    score_b: int | None = None
    winner_entry_id: uuid.UUID | None = None
    status: str


class TournamentDetailOut(BaseModel):
    tournament: TournamentOut
    entries: list[TournamentEntryOut]
    matches: list[TournamentMatchOut]
    my_entry_id: uuid.UUID | None = None
    # Atletas inscritos (por id) para ver o card de cada um na gestão do torneio.
    athletes: dict[str, AthleteOut] = {}


class RegisterRequest(BaseModel):
    athlete_ids: list[uuid.UUID] = Field(min_length=1, max_length=6)


class MatchResultRequest(BaseModel):
    score_a: int = Field(ge=0, le=5)
    score_b: int = Field(ge=0, le=5)
