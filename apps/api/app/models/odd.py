"""Models ORM: sistema de Odds (apostas com multiplicador, criadas pelo dono).

- `Odd`: a aposta publicada pelo dono. Tipo "vitoria" = confronto Time A x Time B,
  cada lado com seu multiplicador (odd). O dono define o vencedor ao liquidar.
- `OddBet`: a aposta de um usuário (lado escolhido, moeda, valor). O valor é
  debitado ao apostar; ao liquidar, o vencedor recebe ceil(valor × multiplicador).

Pagamento sempre arredonda PARA CIMA (ex.: 10 × 2.14 = 21.40 → 22).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

ODD_TYPES = ("vitoria",)


class Odd(Base):
    __tablename__ = "odds"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, default="vitoria", nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    # Confronto (tipo "vitoria"): dois lados, cada um com seu multiplicador.
    team_a_name: Mapped[str] = mapped_column(String, default="Time A", nullable=False)
    team_a_odd: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)
    team_b_name: Mapped[str] = mapped_column(String, default="Time B", nullable=False)
    team_b_odd: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)
    # Ciclo de vida: open (aceita apostas) -> settled (liquidada) / cancelled.
    status: Mapped[str] = mapped_column(String, default="open", nullable=False)
    winner: Mapped[str | None] = mapped_column(String, nullable=True)  # "a" | "b"
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OddBet(Base):
    __tablename__ = "odd_bets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    odd_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    selection: Mapped[str] = mapped_column(String, nullable=False)  # "a" | "b"
    currency: Mapped[str] = mapped_column(String, default="silver", nullable=False)
    amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Multiplicador travado no momento da aposta (não muda se o dono editar a Odd).
    odd_value: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)
    # pending -> won / lost / refunded
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    payout: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
