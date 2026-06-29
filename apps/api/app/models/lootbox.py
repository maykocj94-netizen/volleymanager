"""Models ORM: Lootbox (caixas) e seus itens (recompensas sorteadas).

O dono cria caixas (nome, raridade, custo por giro) e adiciona itens:
- revelation: gera um atleta revelação aleatório (oferta infinita).
- custom: um atleta personalizado (template; oferta infinita).
- listing: um atleta de anúncio (contratação). É ÚNICO — ao ser ganho, sai do
  mercado e vai para o elenco do ganhador (pelos dias de validade do anúncio).

Cada item tem uma probabilidade (peso) de sair. Itens `listing` já ganhos ficam
marcados (won_by) e aparecem "apagados" na info da caixa.
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

LOOTBOX_RARITIES = ("comum", "raro", "super_raro", "lendario")
LOOTBOX_ITEM_KINDS = ("revelation", "listing", "custom")


class Lootbox(Base):
    __tablename__ = "lootboxes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    rarity: Mapped[str] = mapped_column(String, default="comum", nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # Custo por giro ("tiro").
    cost_currency: Mapped[str] = mapped_column(String, default="silver", nullable=False)
    cost_amount: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LootboxItem(Base):
    __tablename__ = "lootbox_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lootbox_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # revelation|listing|custom
    probability: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)  # peso (%)
    label: Mapped[str] = mapped_column(String, default="Item", nullable=False)
    # Para kind=listing: o anúncio (HireListing) referenciado (único).
    listing_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    # Payload específico do tipo:
    #   revelation: { "modality": "beach_m" }
    #   custom: { first_name, last_name, country, sex, modality, court_position,
    #             beach_position, age, height_cm, weight_kg, attributes,
    #             current_ability, potential_ability }
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    # Item de contratação já ganho por alguém (sai do mercado e da caixa).
    won_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
