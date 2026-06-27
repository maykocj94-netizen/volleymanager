"""Models ORM: ecossistema Loja → Centro de Treinamento (CT).

- `StoreProduct`: produto publicado pelo dono na Loja. Cada compra concede
  `quantity` unidades de um `item_type` (categoria do catálogo em engine/ct.py).
- `InventoryItem`: baú do jogador — quantidade de cada item_type que ele possui.
- `TrainingCenter`: um CT montado (praia ou quadra). A presença da linha indica
  que o CT está construído; `equipped` guarda a composição consumida do baú.
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StoreProduct(Base):
    __tablename__ = "store_products"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    # Categoria do CT que o produto concede (terreno, areia, poste, ...).
    item_type: Mapped[str] = mapped_column(String, nullable=False)
    # Unidades do item_type concedidas por compra (ex.: "Kit 4 postes" → 4).
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # Preço em prata e/ou ouro (0 = não vende naquela moeda). Critério do dono.
    price_silver: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    price_gold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    item_type: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TrainingCenter(Base):
    __tablename__ = "training_centers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    # Disciplina do CT: "beach" (praia) ou "indoor" (quadra).
    kind: Mapped[str] = mapped_column(String, nullable=False)
    # Composição consumida do baú ao montar ({ item_type: quantidade }).
    equipped: Mapped[dict] = mapped_column(JSON, default=dict)
    built_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
