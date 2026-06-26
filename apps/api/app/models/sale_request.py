"""Model ORM: pedido de venda de atleta (aprovação do dono).

O jogador anuncia um atleta; em vez de vender na hora, cria um pedido que cai
no painel do dono (admin), que confirma ou recusa a venda.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SaleRequest(Base):
    __tablename__ = "sale_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)  # pending|approved|rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
