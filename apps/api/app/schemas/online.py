"""Schemas (DTOs) do Desafio Online X1."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.athlete import AthleteOut
from app.schemas.match import MatchEventOut


class OnlineUserOut(BaseModel):
    user_id: uuid.UUID
    team_name: str
    city: str | None = None
    reputation: int
    online_wins: int
    online_losses: int


class ChallengeBrief(BaseModel):
    id: uuid.UUID
    challenger_id: uuid.UUID
    opponent_id: uuid.UUID
    challenger_name: str
    opponent_name: str
    kind: str
    sex: str
    bet_currency: str
    bet_amount: int
    status: str


class HeartbeatOut(BaseModel):
    online: list[OnlineUserOut]
    incoming: list[ChallengeBrief]
    outgoing: list[ChallengeBrief]
    active_id: uuid.UUID | None = None


class ChallengeCreate(BaseModel):
    opponent_id: uuid.UUID
    kind: Literal["beach", "indoor"] = "beach"
    sex: Literal["male", "female"] = "male"
    currency: Literal["silver", "gold"] = "silver"
    amount: int = Field(default=0, ge=0, le=1_000_000)


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    challenger_id: uuid.UUID
    opponent_id: uuid.UUID
    challenger_name: str
    opponent_name: str
    kind: str
    sex: str
    bet_currency: str
    bet_amount: int
    status: str
    challenger_athletes: list[str] = []
    opponent_athletes: list[str] = []
    challenger_ready: bool
    opponent_ready: bool
    winner_id: uuid.UUID | None = None
    score_home: int | None = None
    score_away: int | None = None
    weather: str | None = None
    result_text: str | None = None
    events: list[MatchEventOut] = []

    @field_validator("events", mode="before")
    @classmethod
    def _ensure_events_list(cls, v: object) -> object:
        # Linhas antigas migram a coluna JSON com DEFAULT '{}' (dict): normaliza.
        return v if isinstance(v, list) else []


class LobbyOut(BaseModel):
    challenge: ChallengeOut
    challenger_ath: list[AthleteOut]
    opponent_ath: list[AthleteOut]
    me_is_challenger: bool


class LineupRequest(BaseModel):
    athlete_ids: list[uuid.UUID] = Field(min_length=1, max_length=6)


class RespondRequest(BaseModel):
    accept: bool
