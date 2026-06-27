"""Loja (produtos do dono) e Centro de Treinamento (CT).

Fluxo: o dono publica produtos → o jogador compra (prata/ouro) → as unidades vão
para o baú (InventoryItem) → no CT o jogador monta um CT de Praia ou de Quadra
quando o baú reúne os itens exigidos (que são então consumidos).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.ct import (
    CT_KIND_LABEL,
    CT_KINDS,
    ITEM_EMOJI,
    ITEM_LABEL,
    REQUIREMENTS,
    is_item_type,
)
from app.models.store import InventoryItem, StoreProduct, TrainingCenter
from app.models.user_state import UserState
from app.repositories.user_repo import UserRepository
from app.services.user_service import InsufficientFunds, NotFound


class StoreError(Exception):
    """Erro de regra da Loja/CT (ex.: moeda indisponível, requisitos faltando)."""


def _product_out(p: StoreProduct) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "item_type": p.item_type,
        "quantity": p.quantity,
        "price_silver": p.price_silver,
        "price_gold": p.price_gold,
        "image_url": p.image_url,
        "active": bool(p.active),
        "item_label": ITEM_LABEL.get(p.item_type, p.item_type),
        "item_emoji": ITEM_EMOJI.get(p.item_type, "📦"),
    }


class StoreService:
    """Operações do jogador: comprar, ver baú, montar CT."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # -- Loja --------------------------------------------------------------
    async def list_products(self) -> list[dict]:
        stmt = (
            select(StoreProduct)
            .where(StoreProduct.active.is_(True))
            .order_by(StoreProduct.created_at.desc())
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return [_product_out(p) for p in rows]

    async def _inventory_rows(self, user_id: uuid.UUID) -> list[InventoryItem]:
        stmt = select(InventoryItem).where(InventoryItem.user_id == user_id)
        return list((await self.session.execute(stmt)).scalars().all())

    async def _inventory_map(self, user_id: uuid.UUID) -> dict[str, int]:
        return {r.item_type: r.quantity for r in await self._inventory_rows(user_id)}

    async def inventory(self, user_id: uuid.UUID) -> list[dict]:
        """Baú do jogador (apenas itens com quantidade > 0), ordenado pelo catálogo."""
        owned = await self._inventory_map(user_id)
        out: list[dict] = []
        for item_type in ITEM_LABEL:
            qty = owned.get(item_type, 0)
            if qty <= 0:
                continue
            out.append({
                "item_type": item_type,
                "label": ITEM_LABEL[item_type],
                "emoji": ITEM_EMOJI.get(item_type, "📦"),
                "quantity": qty,
            })
        return out

    async def _add_to_inventory(
        self, user_id: uuid.UUID, item_type: str, qty: int
    ) -> None:
        stmt = select(InventoryItem).where(
            InventoryItem.user_id == user_id, InventoryItem.item_type == item_type
        )
        row = (await self.session.execute(stmt)).scalars().first()
        if row is None:
            row = InventoryItem(
                id=uuid.uuid4(), user_id=user_id, item_type=item_type, quantity=0
            )
            self.session.add(row)
        row.quantity += qty

    async def buy(
        self, user_id: uuid.UUID, product_id: uuid.UUID, currency: str
    ) -> tuple[UserState, list[dict], StoreProduct]:
        repo = UserRepository(self.session)
        state = await repo.get_or_create_state(user_id)
        product = await self.session.get(StoreProduct, product_id)
        if product is None or not product.active:
            raise NotFound("Produto indisponível.")

        if currency == "gold":
            price = product.price_gold
            if price <= 0:
                raise StoreError("Este produto não pode ser comprado com ouro.")
            if state.gold < price:
                raise InsufficientFunds(f"Precisa de {price} de ouro (tem {state.gold}).")
            state.gold -= price
        else:
            price = product.price_silver
            if price <= 0:
                raise StoreError("Este produto não pode ser comprado com prata.")
            if state.silver < price:
                raise InsufficientFunds(f"Precisa de {price} de prata (tem {state.silver}).")
            state.silver -= price

        await self._add_to_inventory(user_id, product.item_type, product.quantity)
        await self.session.flush()
        return state, await self.inventory(user_id), product

    # -- Centro de Treinamento --------------------------------------------
    async def _built_kinds(self, user_id: uuid.UUID) -> dict[str, TrainingCenter]:
        stmt = select(TrainingCenter).where(TrainingCenter.user_id == user_id)
        rows = (await self.session.execute(stmt)).scalars().all()
        return {r.kind: r for r in rows}

    def _center_dict(
        self, kind: str, owned: dict[str, int], built: TrainingCenter | None
    ) -> dict:
        reqs = REQUIREMENTS[kind]
        requirements = []
        all_ok = True
        for item_type, required in reqs.items():
            have = owned.get(item_type, 0)
            ok = have >= required
            all_ok = all_ok and ok
            requirements.append({
                "item_type": item_type,
                "label": ITEM_LABEL[item_type],
                "emoji": ITEM_EMOJI.get(item_type, "📦"),
                "required": required,
                "owned": have,
                "ok": ok,
            })
        return {
            "kind": kind,
            "label": CT_KIND_LABEL[kind],
            "built": built is not None,
            "built_at": built.built_at if built is not None else None,
            "requirements": requirements,
            "can_build": built is None and all_ok,
        }

    async def centers(self, user_id: uuid.UUID) -> list[dict]:
        owned = await self._inventory_map(user_id)
        built = await self._built_kinds(user_id)
        return [self._center_dict(k, owned, built.get(k)) for k in CT_KINDS]

    async def build_center(self, user_id: uuid.UUID, kind: str) -> tuple[dict, str]:
        if kind not in REQUIREMENTS:
            raise NotFound("Tipo de CT inválido.")
        built = await self._built_kinds(user_id)
        if kind in built:
            raise StoreError("Você já montou este CT.")

        rows = {r.item_type: r for r in await self._inventory_rows(user_id)}
        owned = {t: r.quantity for t, r in rows.items()}
        reqs = REQUIREMENTS[kind]
        missing = [t for t, need in reqs.items() if owned.get(t, 0) < need]
        if missing:
            faltam = ", ".join(ITEM_LABEL[t] for t in missing)
            raise StoreError(f"Faltam itens no baú para montar o CT: {faltam}.")

        # Consome os itens exigidos do baú (ficam "equipados" no CT).
        for item_type, need in reqs.items():
            rows[item_type].quantity -= need
        center = TrainingCenter(
            id=uuid.uuid4(),
            user_id=user_id,
            kind=kind,
            equipped=dict(reqs),
            built_at=datetime.now(timezone.utc),
        )
        self.session.add(center)
        await self.session.flush()
        message = f"Parabéns, você conquistou seu próprio {CT_KIND_LABEL[kind]}!"
        return self._center_dict(kind, await self._inventory_map(user_id), center), message


class StoreAdminService:
    """CRUD de produtos da Loja (somente dono)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_products(self) -> list[dict]:
        stmt = select(StoreProduct).order_by(StoreProduct.created_at.desc())
        rows = (await self.session.execute(stmt)).scalars().all()
        return [_product_out(p) for p in rows]

    def _validate_type(self, item_type: str) -> None:
        if not is_item_type(item_type):
            raise StoreError(
                f"Categoria '{item_type}' inválida. Use uma categoria do CT."
            )

    async def create_product(self, data: dict) -> dict:
        self._validate_type(data["item_type"])
        product = StoreProduct(
            id=uuid.uuid4(),
            name=data["name"],
            description=data.get("description"),
            item_type=data["item_type"],
            quantity=int(data.get("quantity", 1)),
            price_silver=int(data.get("price_silver", 0)),
            price_gold=int(data.get("price_gold", 0)),
            image_url=data.get("image_url"),
            active=bool(data.get("active", True)),
        )
        self.session.add(product)
        await self.session.flush()
        return _product_out(product)

    async def update_product(self, product_id: uuid.UUID, data: dict) -> dict:
        product = await self.session.get(StoreProduct, product_id)
        if product is None:
            raise NotFound("Produto não encontrado.")
        if data.get("item_type") is not None:
            self._validate_type(data["item_type"])
        for key in (
            "name", "description", "item_type", "quantity",
            "price_silver", "price_gold", "image_url", "active",
        ):
            if data.get(key) is not None:
                setattr(product, key, data[key])
        await self.session.flush()
        return _product_out(product)

    async def delete_product(self, product_id: uuid.UUID) -> None:
        product = await self.session.get(StoreProduct, product_id)
        if product is None:
            raise NotFound("Produto não encontrado.")
        await self.session.delete(product)
