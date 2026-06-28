"""Model ORM: estado do jogador (carteira, login diário, escalações)."""

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

STARTING_SILVER = 3000
STARTING_GOLD = 0
HIRE_COST = 1000
# Revelação nasce fraca: pontuação final (e atributos) no máximo isto.
REVELATION_MAX_ABILITY = 55
LOGIN_STREAK_TARGET = 7
LOGIN_STREAK_BONUS = 3000
# Troca de cenário da partida (dificuldade/clima): 3 grátis por semana, depois custa.
SCENARIO_FREE_REROLLS = 3
SCENARIO_REROLL_COST = 200


class UserState(Base):
    __tablename__ = "user_state"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    # E-mail de login (capturado do JWT no /me) — exibido na central de contas.
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    silver: Mapped[int] = mapped_column(Integer, default=STARTING_SILVER)
    gold: Mapped[int] = mapped_column(Integer, default=STARTING_GOLD)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    # Aprovação de entrada: contas novas (produção) entram bloqueadas até o dono
    # aprovar. Default True para não bloquear contas/saves já existentes na
    # migração; novas contas reais recebem False explicitamente no onboarding.
    approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Estatísticas de partidas (Painel: jogadas / vitórias / derrotas / K-D).
    matches_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    matches_won: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    matches_lost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Desafios X1 online.
    online_wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    online_losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Presença online (heartbeat): última vez visto no jogo.
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # { "beach": [athlete_id, ...], "indoor": [athlete_id, ...] }
    lineup: Mapped[dict] = mapped_column(JSON, default=dict)
    # Cenário atual da partida contra a CPU (estável até trocar):
    #   { tier, base, tactic, weather, name_seed }
    scenario: Mapped[dict] = mapped_column(JSON, default=dict)
    reroll_week_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    reroll_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
