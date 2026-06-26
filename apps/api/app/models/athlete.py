"""Models ORM: Athlete e AthleteAttributes."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Athlete(Base):
    __tablename__ = "athletes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    club_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("clubs.id", ondelete="SET NULL"), nullable=True
    )
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    height_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    handedness: Mapped[str] = mapped_column(String, default="right")
    sex: Mapped[str] = mapped_column(String, nullable=False, default="male")
    modality: Mapped[str] = mapped_column(String, nullable=False)
    court_position: Mapped[str | None] = mapped_column(String, nullable=True)
    beach_position: Mapped[str | None] = mapped_column(String, nullable=True)
    current_ability: Mapped[int] = mapped_column(Integer, default=50)
    potential_ability: Mapped[int] = mapped_column(Integer, default=60)
    morale: Mapped[int] = mapped_column(Integer, default=70)
    fatigue: Mapped[int] = mapped_column(Integer, default=0)
    form: Mapped[int] = mapped_column(Integer, default=50)
    market_value: Mapped[int] = mapped_column(Integer, default=0)
    salary: Mapped[int] = mapped_column(Integer, default=0)
    contract_until: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_injured: Mapped[bool] = mapped_column(Boolean, default=False)
    # Desempenho acumulado (alimenta a valorização de venda no mercado).
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Atleta personalizado criado pelo jogador (aparece em Mercado → Contratações).
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    club: Mapped["Club | None"] = relationship(  # noqa: F821
        back_populates="athletes", lazy="joined"
    )
    attributes: Mapped["AthleteAttributes"] = relationship(
        back_populates="athlete", lazy="joined", cascade="all, delete-orphan", uselist=False
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def sale_value(self) -> int:
        """Preço de venda: base pela habilidade, valorizado por vitórias e
        desvalorizado por derrotas (cada vitória +4%, cada derrota −3%)."""
        base = round((self.current_ability or 50) ** 2 * 0.5)
        mult = 1.0 + 0.04 * (self.wins or 0) - 0.03 * (self.losses or 0)
        mult = max(0.4, min(2.5, mult))
        return max(100, round(base * mult))


class AthleteAttributes(Base):
    __tablename__ = "athlete_attributes"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("athletes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    serve: Mapped[int] = mapped_column(Integer, default=50)
    attack: Mapped[int] = mapped_column(Integer, default=50)
    block: Mapped[int] = mapped_column(Integer, default=50)
    defense: Mapped[int] = mapped_column(Integer, default=50)
    reception: Mapped[int] = mapped_column(Integer, default=50)
    setting: Mapped[int] = mapped_column(Integer, default=50)
    speed: Mapped[int] = mapped_column(Integer, default=50)
    jump: Mapped[int] = mapped_column(Integer, default=50)
    stamina: Mapped[int] = mapped_column(Integer, default=50)
    positioning: Mapped[int] = mapped_column(Integer, default=50)
    decision: Mapped[int] = mapped_column(Integer, default=50)
    concentration: Mapped[int] = mapped_column(Integer, default=50)
    competitiveness: Mapped[int] = mapped_column(Integer, default=50)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    athlete: Mapped["Athlete"] = relationship(back_populates="attributes")
