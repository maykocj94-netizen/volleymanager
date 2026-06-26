"""Schemas para simulação de partidas (modo exibição/teste da engine)."""

from pydantic import BaseModel, Field

from app.enums import Modality, Tactic, Weather


class TeamSpec(BaseModel):
    """Forças agregadas de uma equipe (0–100) para a engine."""

    name: str
    serve: float = Field(default=60, ge=0, le=100)
    attack: float = Field(default=60, ge=0, le=100)
    block: float = Field(default=60, ge=0, le=100)
    defense: float = Field(default=60, ge=0, le=100)
    reception: float = Field(default=60, ge=0, le=100)
    setting: float = Field(default=60, ge=0, le=100)
    players: list[str] = Field(default_factory=list)
    chemistry: float = Field(default=50, ge=0, le=100)
    morale: float = Field(default=70, ge=0, le=100)
    fatigue: float = Field(default=0, ge=0, le=100)
    tactic: Tactic = Tactic.BALANCED


class ExhibitionRequest(BaseModel):
    modality: Modality
    weather: Weather | None = None
    seed: int | None = None
    home: TeamSpec
    away: TeamSpec


class SetScoreOut(BaseModel):
    set_no: int
    home: int
    away: int


class MatchEventOut(BaseModel):
    set_no: int
    rally_no: int
    event_type: str
    side: str
    text: str
    athlete: str | None = None


class MatchResultOut(BaseModel):
    home_sets: int
    away_sets: int
    winner: str
    sets: list[SetScoreOut]
    events: list[MatchEventOut]
