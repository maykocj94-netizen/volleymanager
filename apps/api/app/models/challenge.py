"""Model ORM: Desafio Online X1 (challenge + sala + resultado num só registro).

Fluxo: pending (convite) -> accepted (sala: cada um escala e fica pronto) ->
running -> finished. Também pode ser declined/cancelled.
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    challenger_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    opponent_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    challenger_name: Mapped[str] = mapped_column(String, default="Time", nullable=False)
    opponent_name: Mapped[str] = mapped_column(String, default="Time", nullable=False)
    # Categoria do confronto.
    kind: Mapped[str] = mapped_column(String, default="beach", nullable=False)  # beach|indoor
    sex: Mapped[str] = mapped_column(String, default="male", nullable=False)    # male|female
    # Aposta: mesma moeda e quantia para os dois; o vencedor leva o total.
    bet_currency: Mapped[str] = mapped_column(String, default="silver", nullable=False)
    bet_amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    # Escalações (travadas ao ficar pronto).
    challenger_athletes: Mapped[list] = mapped_column(JSON, default=list)
    opponent_athletes: Mapped[list] = mapped_column(JSON, default=list)
    challenger_ready: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    opponent_ready: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Resultado (challenger = "home").
    winner_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weather: Mapped[str | None] = mapped_column(String, nullable=True)
    result_text: Mapped[str | None] = mapped_column(String, nullable=True)
    # Narração rally a rally (para reprodução no cliente, como a Partida Single).
    events: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
