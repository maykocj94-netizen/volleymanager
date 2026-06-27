"""Controller: Loja (compra de produtos) e Centro de Treinamento (CT)."""

import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentUser, DbSession
from app.repositories.user_repo import UserRepository
from app.schemas.store import (
    BuildResult,
    BuyRequest,
    BuyResult,
    CenterOut,
    InventoryItemOut,
    ProductOut,
)
from app.services.store_service import InsufficientFunds, NotFound, StoreError, StoreService

router = APIRouter(prefix="/store", tags=["store"])


def _state_out(state, club):  # noqa: ANN001, ANN202
    from app.api.v1.me import _to_out
    return _to_out(state, club)


@router.get("/products", response_model=list[ProductOut])
async def list_products(session: DbSession, _user: CurrentUser) -> list[ProductOut]:
    """Produtos publicados pelo dono (à venda para todos)."""
    rows = await StoreService(session).list_products()
    return [ProductOut(**r) for r in rows]


@router.get("/inventory", response_model=list[InventoryItemOut])
async def get_inventory(session: DbSession, user: CurrentUser) -> list[InventoryItemOut]:
    """Baú de itens do jogador."""
    rows = await StoreService(session).inventory(uuid.UUID(user.id))
    return [InventoryItemOut(**r) for r in rows]


@router.post("/buy", response_model=BuyResult)
async def buy_product(body: BuyRequest, session: DbSession, user: CurrentUser) -> BuyResult:
    """Compra um produto (prata ou ouro). As unidades vão para o baú."""
    uid = uuid.UUID(user.id)
    try:
        state, inventory, product = await StoreService(session).buy(
            uid, body.product_id, body.currency
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientFunds as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except StoreError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    club = await UserRepository(session).get_main_club(uid)
    return BuyResult(
        state=_state_out(state, club),
        inventory=[InventoryItemOut(**i) for i in inventory],
        granted_item=product.item_type,
        granted_qty=product.quantity,
    )


@router.get("/centers", response_model=list[CenterOut])
async def get_centers(session: DbSession, user: CurrentUser) -> list[CenterOut]:
    """Estado dos CTs (praia e quadra): requisitos, baú e se já está montado."""
    rows = await StoreService(session).centers(uuid.UUID(user.id))
    return [CenterOut(**c) for c in rows]


@router.post("/centers/{kind}/build", response_model=BuildResult)
async def build_center(
    kind: Literal["beach", "indoor"], session: DbSession, user: CurrentUser
) -> BuildResult:
    """Monta um CT consumindo os itens exigidos do baú."""
    uid = uuid.UUID(user.id)
    svc = StoreService(session)
    try:
        center, message = await svc.build_center(uid, kind)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StoreError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return BuildResult(
        center=CenterOut(**center),
        centers=[CenterOut(**c) for c in await svc.centers(uid)],
        inventory=[InventoryItemOut(**i) for i in await svc.inventory(uid)],
        message=message,
    )
