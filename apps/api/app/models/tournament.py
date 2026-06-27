"""Models ORM do módulo de Competições (torneios).

- Tournament: o evento (tipo, categoria, vagas, premiação, status).
- TournamentEntry: a inscrição de um usuário (time + atletas travados, standings).
- TournamentMatch: uma partida do torneio (resultado definido pelo dono).

Tipos: round_robin (pontos corridos), knockout (mata-mata), groups (chaves de
grupo), repechage (repescagem). Status: open (inscrições) -> running (gestão do
dono) -> finished (premiado).
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

TOURNAMENT_TYPES = ("round_robin", "knockout", "groups", "repechage")


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default="round_robin", nullable=False)
    # Categoria: praia (dupla) ou quadra (sexteto), e sexo.
    kind: Mapped[str] = mapped_column(String, default="beach", nullable=False)  # beach|indoor
    sex: Mapped[str] = mapped_column(String, default="male", nullable=False)    # male|female
    slots: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    # Chaves de grupo.
    num_groups: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    teams_per_group: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    advance_per_group: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    # Premiação por colocação (prata e ouro).
    prize_silver_1: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_silver_2: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_silver_3: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_gold_1: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_gold_2: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prize_gold_3: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)  # open|running|finished
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TournamentEntry(Base):
    __tablename__ = "tournament_entries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    club_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    team_name: Mapped[str] = mapped_column(String, default="Time", nullable=False)
    # Atletas escalados (travados após inscrição).
    athlete_ids: Mapped[list] = mapped_column(JSON, default=list)
    group_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Classificação (pontos corridos / grupos).
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sets_won: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sets_lost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    eliminated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    placement: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1,2,3...
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TournamentMatch(Base):
    __tablename__ = "tournament_matches"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    stage: Mapped[str] = mapped_column(String, default="rr", nullable=False)
    group_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    round_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    entry_a_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    entry_b_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    a_name: Mapped[str] = mapped_column(String, default="—", nullable=False)
    b_name: Mapped[str] = mapped_column(String, default="—", nullable=False)
    score_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_b: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner_entry_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)  # pending|done
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
