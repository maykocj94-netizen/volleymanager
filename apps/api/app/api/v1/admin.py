"""Controller: central de contas (admin) — protegida por X-Admin-Token."""

import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import AdminAuth, DbSession
from app.schemas.admin import (
    AdminAddAthlete,
    AdminUser,
    AdminWallet,
    ApproveRequest,
    AthletePatch,
    CoinAdjust,
)
from app.schemas.athlete import AthleteOut
from app.schemas.market import (
    HireListingCreate,
    HireListingOut,
    HireListingUpdate,
    SaleRequestOut,
)
from app.schemas.odd import (
    OddAdminDetailOut,
    OddBetAdminOut,
    OddCreate,
    OddOut,
    OddUpdate,
    SettleRequest,
)
from app.schemas.store import ProductCreate, ProductOut, ProductUpdate
from app.schemas.tournament import (
    MatchResultRequest,
    TournamentCreate,
    TournamentDetailOut,
    TournamentEntryOut,
    TournamentMatchOut,
    TournamentOut,
)
from app.services.admin_service import AdminService
from app.services.market_service import expire_due
from app.services.sales_service import SalesService
from app.services.odd_service import OddAdminService, OddError
from app.services.store_service import StoreAdminService, StoreError
from app.services.tournament_service import NotFound as TournamentNotFound
from app.services.tournament_service import TournamentError, TournamentService
from app.services.user_service import NotFound

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUser])
async def list_users(session: DbSession, _admin: AdminAuth) -> list[AdminUser]:
    rows = await AdminService(session).list_users()
    return [AdminUser(**r) for r in rows]


@router.get("/users/{user_id}/athletes", response_model=list[AthleteOut])
async def user_athletes(
    user_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> list[AthleteOut]:
    athletes = await AdminService(session).list_user_athletes(user_id)
    return [AthleteOut.model_validate(a) for a in athletes]


@router.patch("/athletes/{athlete_id}", response_model=AthleteOut)
async def patch_athlete(
    athlete_id: uuid.UUID, body: AthletePatch, session: DbSession, _admin: AdminAuth
) -> AthleteOut:
    try:
        athlete = await AdminService(session).patch_athlete(
            athlete_id, body.model_dump(exclude_unset=True)
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)


@router.post("/athletes/{athlete_id}/heal", response_model=AthleteOut)
async def heal_athlete(
    athlete_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> AthleteOut:
    """Remove o status de fadigado/lesionado do atleta."""
    try:
        athlete = await AdminService(session).heal_athlete(athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AthleteOut.model_validate(athlete)


@router.post("/users/{user_id}/athletes", response_model=AthleteOut, status_code=201)
async def add_athlete(
    user_id: uuid.UUID, body: AdminAddAthlete, session: DbSession, _admin: AdminAuth
) -> AthleteOut:
    athlete = await AdminService(session).add_athlete(user_id, body.modality)
    return AthleteOut.model_validate(athlete)


@router.delete("/athletes/{athlete_id}")
async def remove_athlete(
    athlete_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await AdminService(session).remove_athlete(athlete_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/users/{user_id}/coins", response_model=AdminWallet)
async def adjust_coins(
    user_id: uuid.UUID, body: CoinAdjust, session: DbSession, _admin: AdminAuth
) -> AdminWallet:
    state = await AdminService(session).adjust_coins(
        user_id, body.silver_delta, body.gold_delta
    )
    return AdminWallet(user_id=user_id, silver=state.silver, gold=state.gold)


# --- Aprovação de entrada de contas ---------------------------------------
@router.post("/users/{user_id}/approve", response_model=AdminUser)
async def approve_user(
    user_id: uuid.UUID, body: ApproveRequest, session: DbSession, _admin: AdminAuth
) -> AdminUser:
    await AdminService(session).set_approved(user_id, body.approved)
    rows = await AdminService(session).list_users()
    row = next((r for r in rows if str(r["user_id"]) == str(user_id)), None)
    if row is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return AdminUser(**row)


# --- Vendas (aprovação do dono) -------------------------------------------
@router.get("/sales", response_model=list[SaleRequestOut])
async def list_sales(session: DbSession, _admin: AdminAuth) -> list[SaleRequestOut]:
    rows = await SalesService(session).list_pending()
    return [SaleRequestOut(**r) for r in rows]


@router.post("/sales/{request_id}/approve", response_model=dict)
async def approve_sale(
    request_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict:
    try:
        await SalesService(session).approve(request_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/sales/{request_id}/reject", response_model=dict)
async def reject_sale(
    request_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict:
    try:
        await SalesService(session).reject(request_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


# --- Anúncios de contratação (criação personalizada — só admin) -----------
@router.get("/listings", response_model=list[HireListingOut])
async def list_listings(session: DbSession, _admin: AdminAuth) -> list[HireListingOut]:
    # Marca como "expired" os anúncios cujo contrato venceu (e remove o atleta),
    # mesmo que o comprador ainda não tenha reaberto o jogo.
    await expire_due(session)
    listings = await AdminService(session).list_listings()
    return [HireListingOut.model_validate(li) for li in listings]


@router.post("/listings", response_model=HireListingOut, status_code=201)
async def create_listing(
    body: HireListingCreate, session: DbSession, _admin: AdminAuth
) -> HireListingOut:
    data = body.model_dump(mode="json")
    data["attributes"] = body.attributes.model_dump()
    listing = await AdminService(session).create_listing(data)
    return HireListingOut.model_validate(listing)


@router.patch("/listings/{listing_id}", response_model=HireListingOut)
async def update_listing(
    listing_id: uuid.UUID, body: HireListingUpdate, session: DbSession, _admin: AdminAuth
) -> HireListingOut:
    data = body.model_dump(exclude_unset=True)
    if body.attributes is not None:
        data["attributes"] = body.attributes.model_dump()
    try:
        listing = await AdminService(session).update_listing(listing_id, data)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return HireListingOut.model_validate(listing)


@router.post("/listings/{listing_id}/republish", response_model=HireListingOut)
async def republish_listing(
    listing_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> HireListingOut:
    try:
        listing = await AdminService(session).republish_listing(listing_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return HireListingOut.model_validate(listing)


@router.delete("/listings/{listing_id}")
async def delete_listing(
    listing_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await AdminService(session).delete_listing(listing_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


# --- Competições (torneios) -----------------------------------------------
async def _tour_detail(svc: TournamentService, tid: uuid.UUID) -> TournamentDetailOut:
    t = await svc.get(tid)
    entries = await svc.get_entries(tid)
    matches = await svc.get_matches(tid)
    athletes = await svc.entry_athletes(entries)
    return TournamentDetailOut(
        tournament=TournamentOut(**svc._tour_dict(t, len(entries))),
        entries=[TournamentEntryOut.model_validate(e) for e in entries],
        matches=[TournamentMatchOut.model_validate(m) for m in matches],
        my_entry_id=None,
        athletes={aid: AthleteOut.model_validate(a) for aid, a in athletes.items()},
    )


@router.get("/tournaments", response_model=list[TournamentOut])
async def admin_list_tournaments(session: DbSession, _admin: AdminAuth) -> list[TournamentOut]:
    rows = await TournamentService(session).list_for_users()
    return [TournamentOut(**r) for r in rows]


@router.post("/tournaments", response_model=TournamentOut, status_code=201)
async def admin_create_tournament(
    body: TournamentCreate, session: DbSession, _admin: AdminAuth
) -> TournamentOut:
    svc = TournamentService(session)
    t = await svc.create(body.model_dump())
    return TournamentOut(**svc._tour_dict(t, 0))


@router.get("/tournaments/{tid}", response_model=TournamentDetailOut)
async def admin_tournament_detail(
    tid: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> TournamentDetailOut:
    try:
        return await _tour_detail(TournamentService(session), tid)
    except TournamentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tournaments/{tid}/start", response_model=TournamentDetailOut)
async def admin_start_tournament(
    tid: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> TournamentDetailOut:
    svc = TournamentService(session)
    try:
        await svc.start(tid)
        return await _tour_detail(svc, tid)
    except TournamentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TournamentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/tournaments/{tid}/matches/{mid}/result", response_model=TournamentDetailOut)
async def admin_set_match_result(
    tid: uuid.UUID, mid: uuid.UUID, body: MatchResultRequest, session: DbSession, _admin: AdminAuth
) -> TournamentDetailOut:
    svc = TournamentService(session)
    try:
        await svc.set_result(tid, mid, body.score_a, body.score_b)
        return await _tour_detail(svc, tid)
    except TournamentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TournamentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/tournaments/{tid}/advance", response_model=TournamentDetailOut)
async def admin_advance_phase(
    tid: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> TournamentDetailOut:
    svc = TournamentService(session)
    try:
        await svc.advance_phase(tid)
        return await _tour_detail(svc, tid)
    except TournamentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TournamentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/tournaments/{tid}/finish", response_model=TournamentDetailOut)
async def admin_finish_tournament(
    tid: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> TournamentDetailOut:
    svc = TournamentService(session)
    try:
        await svc.finish(tid)
        return await _tour_detail(svc, tid)
    except TournamentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TournamentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/tournaments/{tid}")
async def admin_delete_tournament(
    tid: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await TournamentService(session).delete(tid)
    except TournamentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


# --- Loja (produtos do CT — só admin) -------------------------------------
@router.get("/products", response_model=list[ProductOut])
async def admin_list_products(session: DbSession, _admin: AdminAuth) -> list[ProductOut]:
    rows = await StoreAdminService(session).list_products()
    return [ProductOut(**r) for r in rows]


@router.post("/products", response_model=ProductOut, status_code=201)
async def admin_create_product(
    body: ProductCreate, session: DbSession, _admin: AdminAuth
) -> ProductOut:
    try:
        row = await StoreAdminService(session).create_product(body.model_dump())
    except StoreError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ProductOut(**row)


@router.patch("/products/{product_id}", response_model=ProductOut)
async def admin_update_product(
    product_id: uuid.UUID, body: ProductUpdate, session: DbSession, _admin: AdminAuth
) -> ProductOut:
    try:
        row = await StoreAdminService(session).update_product(
            product_id, body.model_dump(exclude_unset=True)
        )
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except StoreError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ProductOut(**row)


@router.delete("/products/{product_id}")
async def admin_delete_product(
    product_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await StoreAdminService(session).delete_product(product_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


# --- Odds (apostas — só admin) --------------------------------------------
@router.get("/odds", response_model=list[OddOut])
async def admin_list_odds(session: DbSession, _admin: AdminAuth) -> list[OddOut]:
    rows = await OddAdminService(session).list_odds()
    return [OddOut(**r) for r in rows]


@router.get("/odds/{odd_id}", response_model=OddAdminDetailOut)
async def admin_odd_detail(
    odd_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> OddAdminDetailOut:
    try:
        odd, bets, count = await OddAdminService(session).get_detail(odd_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    from app.services.odd_service import _odd_dict
    return OddAdminDetailOut(
        odd=OddOut(**_odd_dict(odd, count)),
        bets=[OddBetAdminOut.model_validate(b) for b in bets],
    )


@router.post("/odds", response_model=OddOut, status_code=201)
async def admin_create_odd(
    body: OddCreate, session: DbSession, _admin: AdminAuth
) -> OddOut:
    try:
        row = await OddAdminService(session).create(body.model_dump())
    except OddError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return OddOut(**row)


@router.patch("/odds/{odd_id}", response_model=OddOut)
async def admin_update_odd(
    odd_id: uuid.UUID, body: OddUpdate, session: DbSession, _admin: AdminAuth
) -> OddOut:
    try:
        row = await OddAdminService(session).update(odd_id, body.model_dump(exclude_unset=True))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OddError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return OddOut(**row)


@router.post("/odds/{odd_id}/settle", response_model=OddOut)
async def admin_settle_odd(
    odd_id: uuid.UUID, body: SettleRequest, session: DbSession, _admin: AdminAuth
) -> OddOut:
    try:
        row = await OddAdminService(session).settle(odd_id, body.winner)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OddError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return OddOut(**row)


@router.post("/odds/{odd_id}/cancel", response_model=OddOut)
async def admin_cancel_odd(
    odd_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> OddOut:
    try:
        row = await OddAdminService(session).cancel(odd_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OddError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return OddOut(**row)


@router.delete("/odds/{odd_id}")
async def admin_delete_odd(
    odd_id: uuid.UUID, session: DbSession, _admin: AdminAuth
) -> dict[str, bool]:
    try:
        await OddAdminService(session).delete(odd_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}
