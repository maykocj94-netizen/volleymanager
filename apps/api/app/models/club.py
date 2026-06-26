"""Model ORM: Club."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Club(Base):
    __tablename__ = "clubs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String, nullable=True)
    crest_url: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    modality: Mapped[str] = mapped_column(String, nullable=False)
    reputation: Mapped[int] = mapped_column(Integer, default=50)
    fanbase: Mapped[int] = mapped_column(Integer, default=1000)
    is_cpu: Mapped[bool] = mapped_column(Boolean, default=False)
    cpu_profile: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    athletes: Mapped[list["Athlete"]] = relationship(  # noqa: F821
        back_populates="club", lazy="selectin"
    )
