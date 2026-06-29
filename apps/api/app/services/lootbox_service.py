"""Lootbox: caixas de recompensa (giro pago com sorteio por probabilidade).

- Admin cria caixas e adiciona itens: revelação (aleatório), contratação
  (anúncio único) ou personalizado (template).
- Usuário paga o custo do giro e sorteia um item pelos pesos (probabilidades).
- Itens de contratação são únicos: ao serem ganhos, saem do mercado e vão para o
  elenco do ganhador (pelos dias de validade do anúncio) e ficam "apagados".
"""

import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.generation import _ALL_ATTRS
from app.enums import Modality
from app.models.athlete import Athlete, AthleteAttributes
from app.models.hire_listing import HireListing
from app.models.lootbox import Lootbox, LootboxItem
from app.models.user_state import REVELATION_MAX_ABILITY, UserState
from app.repositories.athlete_repo import AthleteRepository
from app.repositories.user_repo import UserRepository
from app.services.admin_service import _ability_from
from app.services.athlete_service import AthleteService
from app.services.user_service import InsufficientFunds, NotFound


class LootboxError(Exception):
    """Erro de regra da lootbox (caixa vazia/esgotada, item inválido, etc.)."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _disc_label(modality: str) -> str:
    m = (modality or "").lower()
    return "Praia" if m.startswith("beach") else "Quadra"


# ---- conversões de item em atleta -----------------------------------------
async def _create_from_listing(
    session: AsyncSession, item: LootboxItem, listing: HireListing, club_id: uuid.UUID, winner: uuid.UUID
) -> Athlete:
    now = _now()
    expires = now + timedelta(days=listing.availability_days)
    athlete = Athlete(
        id=uuid.uuid4(),
        club_id=club_id,
        first_name=listing.first_name,
        last_name=listing.last_name,
        country=listing.country,
        birth_date=date(datetime.now().year - int(listing.age or 24), 1, 1),
        height_cm=listing.height_cm,
        weight_kg=listing.weight_kg,
        handedness="right",
        sex=listing.sex,
        modality=listing.modality,
        court_position=listing.court_position,
        beach_position=listing.beach_position,
        current_ability=listing.current_ability,
        potential_ability=listing.potential_ability,
        listing_id=listing.id,
        expires_at=expires,
    )
    attrs = AthleteAttributes(
        athlete_id=athlete.id,
        **{a: int((listing.attributes or {}).get(a, 50)) for a in _ALL_ATTRS},
    )
    athlete.attributes = attrs
    athlete.market_value = athlete.sale_value
    session.add(athlete)
    session.add(attrs)
    # Consome o anúncio (sai do mercado) e marca o item como ganho.
    listing.status = "hired"
    listing.hired_by = winner
    listing.hired_at = now
    listing.expires_at = expires
    listing.athlete_id = athlete.id
    item.won_by = winner
    item.won_at = now
    return athlete


async def _create_custom(session: AsyncSession, data: dict, club_id: uuid.UUID) -> Athlete:
    attrs_in = {a: int((data.get("attributes") or {}).get(a, 50)) for a in _ALL_ATTRS}
    ca = int(data.get("current_ability") or _ability_from(
        attrs_in, data.get("court_position"), data.get("beach_position")
    ))
    pa = int(data.get("potential_ability") or max(ca, min(99, ca + 5)))
    athlete = Athlete(
        id=uuid.uuid4(),
        club_id=club_id,
        first_name=data.get("first_name", "Atleta"),
        last_name=data.get("last_name", "Lootbox"),
        country=data.get("country", "BRA"),
        birth_date=date(datetime.now().year - int(data.get("age", 24)), 1, 1),
        height_cm=int(data.get("height_cm", 190)),
        weight_kg=int(data.get("weight_kg", 85)),
        handedness="right",
        sex=data["sex"],
        modality=data["modality"],
        court_position=data.get("court_position"),
        beach_position=data.get("beach_position"),
        current_ability=ca,
        potential_ability=pa,
    )
    attrs = AthleteAttributes(athlete_id=athlete.id, **attrs_in)
    athlete.attributes = attrs
    athlete.market_value = athlete.sale_value
    session.add(athlete)
    session.add(attrs)
    return athlete


class LootboxService:
    """Operações do usuário: listar caixas, ver info, girar."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _items(self, box_id: uuid.UUID) -> list[LootboxItem]:
        return list((await self.session.execute(
            select(LootboxItem).where(LootboxItem.lootbox_id == box_id)
            .order_by(LootboxItem.created_at)
        )).scalars().all())

    async def _is_available(self, it: LootboxItem) -> bool:
        if it.kind != "listing":
            return True
        if it.won_by is not None or it.listing_id is None:
            return False
        listing = await self.session.get(HireListing, it.listing_id)
        return listing is not None and listing.status in ("published", "expired")

    async def list_active(self) -> list[dict]:
        boxes = (await self.session.execute(
            select(Lootbox).where(Lootbox.active.is_(True)).order_by(Lootbox.created_at.desc())
        )).scalars().all()
        out: list[dict] = []
        for b in boxes:
            items = await self._items(b.id)
            available = 0
            for it in items:
                if await self._is_available(it):
                    available += 1
            out.append({
                "id": b.id, "name": b.name, "rarity": b.rarity, "description": b.description,
                "image_url": b.image_url, "cost_currency": b.cost_currency,
                "cost_amount": b.cost_amount, "item_count": len(items),
                "available_count": available,
            })
        return out

    async def info(self, box_id: uuid.UUID) -> dict:
        """Info da caixa: atletas de CONTRATAÇÃO dentro dela (com status de ganho)."""
        box = await self.session.get(Lootbox, box_id)
        if box is None:
            raise NotFound("Caixa não encontrada.")
        items = await self._items(box_id)
        listings: list[dict] = []
        n_rev = 0
        n_custom = 0
        for it in items:
            if it.kind == "revelation":
                n_rev += 1
                continue
            if it.kind == "custom":
                n_custom += 1
                continue
            listing = await self.session.get(HireListing, it.listing_id) if it.listing_id else None
            claimed = it.won_by is not None or (listing is not None and listing.status == "hired")
            listings.append({
                "item_id": it.id,
                "name": f"{listing.first_name} {listing.last_name}" if listing else it.label,
                "current_ability": listing.current_ability if listing else 0,
                "potential_ability": listing.potential_ability if listing else 0,
                "sex": listing.sex if listing else "male",
                "age": listing.age if listing else 0,
                "court_position": listing.court_position if listing else None,
                "beach_position": listing.beach_position if listing else None,
                "attributes": (listing.attributes or {}) if listing else {},
                "probability": it.probability,
                "claimed": claimed,
            })
        return {
            "id": box.id, "name": box.name, "rarity": box.rarity, "description": box.description,
            "cost_currency": box.cost_currency, "cost_amount": box.cost_amount,
            "revelation_count": n_rev, "custom_count": n_custom,
            "listings": listings,
        }

    async def spin(self, user_id: uuid.UUID, box_id: uuid.UUID) -> tuple[UserState, Athlete, dict]:
        box = await self.session.get(Lootbox, box_id)
        if box is None or not box.active:
            raise NotFound("Caixa indisponível.")
        items = await self._items(box_id)
        available = [it for it in items if await self._is_available(it)]
        if not available:
            raise LootboxError("Esta caixa está sem itens disponíveis no momento.")

        repo = UserRepository(self.session)
        state = await repo.get_or_create_state(user_id)
        bal = state.gold if box.cost_currency == "gold" else state.silver
        if bal < box.cost_amount:
            cur = "ouro" if box.cost_currency == "gold" else "prata"
            raise InsufficientFunds(f"Precisa de {box.cost_amount} de {cur} para girar.")

        weights = [max(0.0001, float(it.probability or 0)) for it in available]
        chosen = random.choices(available, weights=weights, k=1)[0]

        club = await repo.get_main_club(user_id)
        club_id = club.id if club else None
        if chosen.kind == "revelation":
            modality = Modality((chosen.data or {}).get("modality", Modality.BEACH_M.value))
            svc = AthleteService(AthleteRepository(self.session))
            made = await svc.generate(
                modality=modality, count=1, club_id=club_id,
                random_sex=True, max_ability=REVELATION_MAX_ABILITY,
            )
            athlete = made[0]
        elif chosen.kind == "custom":
            athlete = await _create_custom(self.session, chosen.data or {}, club_id)
        else:  # listing
            listing = await self.session.get(HireListing, chosen.listing_id)
            if listing is None or listing.status not in ("published", "expired"):
                raise LootboxError("Este prêmio não está mais disponível.")
            athlete = await _create_from_listing(self.session, chosen, listing, club_id, user_id)

        if box.cost_currency == "gold":
            state.gold -= box.cost_amount
        else:
            state.silver -= box.cost_amount
        await self.session.flush()
        won = {"kind": chosen.kind, "label": chosen.label}
        return state, athlete, won


class LootboxAdminService:
    """Operações do dono: criar/editar caixas e itens."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _box_dict(self, b: Lootbox, item_count: int = 0) -> dict:
        return {
            "id": b.id, "name": b.name, "rarity": b.rarity, "description": b.description,
            "image_url": b.image_url, "cost_currency": b.cost_currency,
            "cost_amount": b.cost_amount, "active": bool(b.active), "item_count": item_count,
        }

    async def list_boxes(self) -> list[dict]:
        boxes = (await self.session.execute(
            select(Lootbox).order_by(Lootbox.created_at.desc())
        )).scalars().all()
        out: list[dict] = []
        for b in boxes:
            count = await self.session.scalar(
                select(func.count()).select_from(LootboxItem).where(LootboxItem.lootbox_id == b.id)
            ) or 0
            out.append(self._box_dict(b, int(count)))
        return out

    async def _item_dict(self, it: LootboxItem) -> dict:
        claimed = it.won_by is not None
        listing = None
        if it.kind == "listing" and it.listing_id:
            listing = await self.session.get(HireListing, it.listing_id)
            if listing is not None and listing.status == "hired":
                claimed = True
        return {
            "id": it.id, "kind": it.kind, "probability": it.probability, "label": it.label,
            "listing_id": it.listing_id, "claimed": claimed,
            "current_ability": (listing.current_ability if listing else (it.data or {}).get("current_ability", 0)),
        }

    async def get_detail(self, box_id: uuid.UUID) -> dict:
        box = await self.session.get(Lootbox, box_id)
        if box is None:
            raise NotFound("Caixa não encontrada.")
        rows = list((await self.session.execute(
            select(LootboxItem).where(LootboxItem.lootbox_id == box_id)
            .order_by(LootboxItem.created_at)
        )).scalars().all())
        items = [await self._item_dict(it) for it in rows]
        return {"box": self._box_dict(box, len(rows)), "items": items}

    async def create_box(self, data: dict) -> dict:
        box = Lootbox(
            id=uuid.uuid4(),
            name=data["name"],
            rarity=data.get("rarity", "comum"),
            description=data.get("description"),
            image_url=data.get("image_url"),
            cost_currency=data.get("cost_currency", "silver"),
            cost_amount=int(data.get("cost_amount", 100)),
            active=bool(data.get("active", True)),
        )
        self.session.add(box)
        await self.session.flush()
        return self._box_dict(box, 0)

    async def update_box(self, box_id: uuid.UUID, data: dict) -> dict:
        box = await self.session.get(Lootbox, box_id)
        if box is None:
            raise NotFound("Caixa não encontrada.")
        for key in ("name", "rarity", "description", "image_url", "cost_currency", "active"):
            if data.get(key) is not None:
                setattr(box, key, data[key])
        if data.get("cost_amount") is not None:
            box.cost_amount = max(0, int(data["cost_amount"]))
        await self.session.flush()
        return self._box_dict(box)

    async def delete_box(self, box_id: uuid.UUID) -> None:
        box = await self.session.get(Lootbox, box_id)
        if box is None:
            raise NotFound("Caixa não encontrada.")
        await self.session.execute(
            LootboxItem.__table__.delete().where(LootboxItem.lootbox_id == box_id)
        )
        await self.session.delete(box)
        await self.session.flush()

    async def add_item(self, box_id: uuid.UUID, data: dict) -> dict:
        box = await self.session.get(Lootbox, box_id)
        if box is None:
            raise NotFound("Caixa não encontrada.")
        kind = data.get("kind")
        prob = float(data.get("probability", 10))
        item = LootboxItem(id=uuid.uuid4(), lootbox_id=box_id, kind=kind, probability=prob)
        if kind == "revelation":
            modality = data.get("modality", Modality.BEACH_M.value)
            item.data = {"modality": modality}
            item.label = f"Revelação ({_disc_label(modality)})"
        elif kind == "listing":
            listing = await self.session.get(HireListing, uuid.UUID(str(data["listing_id"])))
            if listing is None:
                raise LootboxError("Anúncio não encontrado.")
            if listing.status not in ("published", "expired"):
                raise LootboxError("Só anúncios não contratados ou expirados podem entrar na caixa.")
            item.listing_id = listing.id
            item.label = f"{listing.first_name} {listing.last_name}"
        elif kind == "custom":
            attrs = {a: int((data.get("attributes") or {}).get(a, 50)) for a in _ALL_ATTRS}
            ca = _ability_from(attrs, data.get("court_position"), data.get("beach_position"))
            pa = max(ca, min(99, ca + int(data.get("potential_bonus", 5))))
            item.data = {
                "first_name": data.get("first_name", "Atleta"),
                "last_name": data.get("last_name", "Personalizado"),
                "country": data.get("country", "BRA"),
                "sex": data["sex"],
                "modality": data["modality"],
                "court_position": data.get("court_position"),
                "beach_position": data.get("beach_position"),
                "age": int(data.get("age", 24)),
                "height_cm": int(data.get("height_cm", 190)),
                "weight_kg": int(data.get("weight_kg", 85)),
                "attributes": attrs,
                "current_ability": ca,
                "potential_ability": pa,
            }
            item.label = f"{item.data['first_name']} {item.data['last_name']}"
        else:
            raise LootboxError("Tipo de item inválido.")
        self.session.add(item)
        await self.session.flush()
        return await self._item_dict(item)

    async def update_item(self, item_id: uuid.UUID, data: dict) -> dict:
        item = await self.session.get(LootboxItem, item_id)
        if item is None:
            raise NotFound("Item não encontrado.")
        if data.get("probability") is not None:
            item.probability = max(0.0, float(data["probability"]))
        await self.session.flush()
        return await self._item_dict(item)

    async def delete_item(self, item_id: uuid.UUID) -> None:
        item = await self.session.get(LootboxItem, item_id)
        if item is None:
            raise NotFound("Item não encontrado.")
        await self.session.delete(item)
        await self.session.flush()
