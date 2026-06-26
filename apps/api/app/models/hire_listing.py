"""Model ORM: anúncio de contratação (marketplace do dono).

O dono (admin) cria atletas e publica em Contratações. Cada anúncio é único:
ao ser contratado por um jogador, some para os demais. O atleta contratado fica
disponível na biblioteca do jogador por `availability_days` (dias reais); depois
expira e o dono é avisado (pode editar e republicar).
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HireListing(Base):
    __tablename__ = "hire_listings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Template do atleta a ser criado ao contratar.
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str] = mapped_column(String, default="BRA", nullable=False)
    sex: Mapped[str] = mapped_column(String, nullable=False)
    modality: Mapped[str] = mapped_column(String, nullable=False)
    court_position: Mapped[str | None] = mapped_column(String, nullable=True)
    beach_position: Mapped[str | None] = mapped_column(String, nullable=True)
    height_cm: Mapped[int] = mapped_column(Integer, default=190, nullable=False)
    weight_kg: Mapped[int] = mapped_column(Integer, default=85, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    current_ability: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    potential_ability: Mapped[int] = mapped_column(Integer, default=65, nullable=False)
    # Economia do anúncio.
    price: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)  # prata
    availability_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    # Ciclo de vida: published -> hired -> expired (-> published de novo ao republicar).
    status: Mapped[str] = mapped_column(String, default="published", nullable=False)
    hired_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    hired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    athlete_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
