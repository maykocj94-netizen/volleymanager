import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminUser,
  AdminWallet,
  Athlete,
  HireListing,
  Lootbox,
  LootboxDetail,
  Modality,
  Odd,
  OddAdminDetail,
  OddSelection,
  SaleRequest,
  StoreProduct,
  Tournament,
  TournamentDetail,
} from "@volley/shared";
import { API_URL } from "./api";

const ADMIN_KEY = "volley_admin_token";
export const getAdminToken = () => localStorage.getItem(ADMIN_KEY);
export const setAdminToken = (t: string) => localStorage.setItem(ADMIN_KEY, t);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_KEY);

async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getAdminToken();
  if (token) headers.set("X-Admin-Token", token);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

// --- chamadas ---
export const adminListUsers = () => adminApi<AdminUser[]>("/api/v1/admin/users");
export const adminUserAthletes = (userId: string) =>
  adminApi<Athlete[]>(`/api/v1/admin/users/${userId}/athletes`);
export const adminAdjustCoins = (userId: string, body: { silver_delta: number; gold_delta: number }) =>
  adminApi<AdminWallet>(`/api/v1/admin/users/${userId}/coins`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const adminPatchAthlete = (athleteId: string, body: Record<string, unknown>) =>
  adminApi<Athlete>(`/api/v1/admin/athletes/${athleteId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const adminAddAthlete = (userId: string, modality: Modality) =>
  adminApi<Athlete>(`/api/v1/admin/users/${userId}/athletes`, {
    method: "POST",
    body: JSON.stringify({ modality }),
  });
export const adminRemoveAthlete = (athleteId: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/athletes/${athleteId}`, { method: "DELETE" });
export const adminHealAthlete = (athleteId: string) =>
  adminApi<Athlete>(`/api/v1/admin/athletes/${athleteId}/heal`, { method: "POST" });

// aprovação de entrada de contas
export const adminApproveUser = (userId: string, approved: boolean) =>
  adminApi<AdminUser>(`/api/v1/admin/users/${userId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });

// edição dos números do painel do usuário
export const adminSetUserStats = (userId: string, body: Record<string, number>) =>
  adminApi<AdminUser>(`/api/v1/admin/users/${userId}/stats`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// vendas (aprovação do dono)
export const adminListSales = () => adminApi<SaleRequest[]>("/api/v1/admin/sales");
export const adminApproveSale = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/sales/${id}/approve`, { method: "POST" });
export const adminRejectSale = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/sales/${id}/reject`, { method: "POST" });

// anúncios de contratação (criação personalizada — só admin)
export const adminListListings = () => adminApi<HireListing[]>("/api/v1/admin/listings");
export const adminCreateListing = (body: Record<string, unknown>) =>
  adminApi<HireListing>("/api/v1/admin/listings", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const adminUpdateListing = (id: string, body: Record<string, unknown>) =>
  adminApi<HireListing>(`/api/v1/admin/listings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const adminRepublishListing = (id: string) =>
  adminApi<HireListing>(`/api/v1/admin/listings/${id}/republish`, { method: "POST" });
export const adminDeleteListing = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/listings/${id}`, { method: "DELETE" });

// loja (produtos do CT — só admin)
export const adminListProducts = () => adminApi<StoreProduct[]>("/api/v1/admin/products");
export const adminCreateProduct = (body: Record<string, unknown>) =>
  adminApi<StoreProduct>("/api/v1/admin/products", { method: "POST", body: JSON.stringify(body) });
export const adminUpdateProduct = (id: string, body: Record<string, unknown>) =>
  adminApi<StoreProduct>(`/api/v1/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const adminDeleteProduct = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/products/${id}`, { method: "DELETE" });

// odds (apostas — só admin)
export const adminListOdds = () => adminApi<Odd[]>("/api/v1/admin/odds");
export const adminOddDetail = (id: string) =>
  adminApi<OddAdminDetail>(`/api/v1/admin/odds/${id}`);
export const adminCreateOdd = (body: Record<string, unknown>) =>
  adminApi<Odd>("/api/v1/admin/odds", { method: "POST", body: JSON.stringify(body) });
export const adminUpdateOdd = (id: string, body: Record<string, unknown>) =>
  adminApi<Odd>(`/api/v1/admin/odds/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const adminSettleOdd = (id: string, winner: OddSelection) =>
  adminApi<Odd>(`/api/v1/admin/odds/${id}/settle`, { method: "POST", body: JSON.stringify({ winner }) });
export const adminCancelOdd = (id: string) =>
  adminApi<Odd>(`/api/v1/admin/odds/${id}/cancel`, { method: "POST" });
export const adminDeleteOdd = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/odds/${id}`, { method: "DELETE" });

// lootbox (caixas — só admin)
export const adminListLootboxes = () => adminApi<Lootbox[]>("/api/v1/admin/lootboxes");
export const adminLootboxDetail = (id: string) =>
  adminApi<LootboxDetail>(`/api/v1/admin/lootboxes/${id}`);
export const adminCreateLootbox = (body: Record<string, unknown>) =>
  adminApi<Lootbox>("/api/v1/admin/lootboxes", { method: "POST", body: JSON.stringify(body) });
export const adminUpdateLootbox = (id: string, body: Record<string, unknown>) =>
  adminApi<Lootbox>(`/api/v1/admin/lootboxes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const adminDeleteLootbox = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/lootboxes/${id}`, { method: "DELETE" });
export const adminAddLootboxItem = (boxId: string, body: Record<string, unknown>) =>
  adminApi<unknown>(`/api/v1/admin/lootboxes/${boxId}/items`, { method: "POST", body: JSON.stringify(body) });
export const adminUpdateLootboxItem = (itemId: string, probability: number) =>
  adminApi<unknown>(`/api/v1/admin/lootboxes/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ probability }) });
export const adminDeleteLootboxItem = (itemId: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/lootboxes/items/${itemId}`, { method: "DELETE" });

// torneios
export const adminListTournaments = () => adminApi<Tournament[]>("/api/v1/admin/tournaments");
export const adminTournamentDetail = (id: string) =>
  adminApi<TournamentDetail>(`/api/v1/admin/tournaments/${id}`);
export const adminCreateTournament = (body: Record<string, unknown>) =>
  adminApi<Tournament>("/api/v1/admin/tournaments", { method: "POST", body: JSON.stringify(body) });
export const adminStartTournament = (id: string) =>
  adminApi<TournamentDetail>(`/api/v1/admin/tournaments/${id}/start`, { method: "POST" });
export const adminSetMatchResult = (id: string, mid: string, scoreA: number, scoreB: number) =>
  adminApi<TournamentDetail>(`/api/v1/admin/tournaments/${id}/matches/${mid}/result`, {
    method: "POST",
    body: JSON.stringify({ score_a: scoreA, score_b: scoreB }),
  });
export const adminAdvancePhase = (id: string) =>
  adminApi<TournamentDetail>(`/api/v1/admin/tournaments/${id}/advance`, { method: "POST" });
export const adminFinishTournament = (id: string) =>
  adminApi<TournamentDetail>(`/api/v1/admin/tournaments/${id}/finish`, { method: "POST" });
export const adminDeleteTournament = (id: string) =>
  adminApi<{ ok: boolean }>(`/api/v1/admin/tournaments/${id}`, { method: "DELETE" });

// --- hooks ---
export function useAdminUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: adminListUsers });
}

export function useAdminAthletes(userId?: string) {
  return useQuery({
    queryKey: ["admin", "athletes", userId],
    queryFn: () => adminUserAthletes(userId!),
    enabled: !!userId,
  });
}

export function useAdminCoins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; silver_delta: number; gold_delta: number }) =>
      adminAdjustCoins(v.userId, { silver_delta: v.silver_delta, gold_delta: v.gold_delta }),
    // Update otimista: a carteira muda na tela na hora, sem esperar o servidor.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["admin", "users"] });
      const prev = qc.getQueryData<AdminUser[]>(["admin", "users"]);
      qc.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) =>
          u.user_id === v.userId
            ? {
                ...u,
                silver: Math.max(0, u.silver + v.silver_delta),
                gold: Math.max(0, u.gold + v.gold_delta),
              }
            : u,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin", "users"], ctx.prev);
    },
    onSuccess: (wallet) => {
      qc.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) =>
          u.user_id === wallet.user_id ? { ...u, silver: wallet.silver, gold: wallet.gold } : u,
        ),
      );
    },
  });
}

export function useAdminPatchAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { athleteId: string; body: Record<string, unknown> }) =>
      adminPatchAthlete(v.athleteId, v.body),
    onSuccess: (athlete) => {
      qc.setQueryData<Athlete[]>(["admin", "athletes", userId], (old) =>
        old?.map((a) => (a.id === athlete.id ? athlete : a)),
      );
    },
  });
}

export function useAdminHealAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => adminHealAthlete(athleteId),
    onSuccess: (athlete) => {
      qc.setQueryData<Athlete[]>(["admin", "athletes", userId], (old) =>
        old?.map((a) => (a.id === athlete.id ? athlete : a)),
      );
    },
  });
}

export function useAdminAddAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modality: Modality) => adminAddAthlete(userId!, modality),
    onSuccess: (athlete) => {
      qc.setQueryData<Athlete[]>(["admin", "athletes", userId], (old) => [...(old ?? []), athlete]);
      qc.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) => (u.user_id === userId ? { ...u, athlete_count: u.athlete_count + 1 } : u)),
      );
    },
  });
}

export function useAdminRemoveAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => adminRemoveAthlete(athleteId),
    onSuccess: (_res, athleteId) => {
      qc.setQueryData<Athlete[]>(["admin", "athletes", userId], (old) =>
        old?.filter((a) => a.id !== athleteId),
      );
      qc.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) =>
          u.user_id === userId ? { ...u, athlete_count: Math.max(0, u.athlete_count - 1) } : u,
        ),
      );
    },
  });
}

export function useAdminApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; approved: boolean }) =>
      adminApproveUser(v.userId, v.approved),
    onSuccess: (user) => {
      qc.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) => (u.user_id === user.user_id ? user : u)),
      );
    },
  });
}

export function useAdminSetUserStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; body: Record<string, number> }) =>
      adminSetUserStats(v.userId, v.body),
    onSuccess: (user) => {
      qc.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) => (u.user_id === user.user_id ? user : u)),
      );
    },
  });
}

export function useAdminSales() {
  return useQuery({ queryKey: ["admin", "sales"], queryFn: adminListSales });
}

export function useAdminResolveSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean }) =>
      v.approve ? adminApproveSale(v.id) : adminRejectSale(v.id),
    onSuccess: (_res, v) => {
      qc.setQueryData<SaleRequest[]>(["admin", "sales"], (old) =>
        old?.filter((s) => s.id !== v.id),
      );
      // Aprovar credita prata ao vendedor — a carteira mudou no servidor.
      if (v.approve) qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminListings() {
  return useQuery({ queryKey: ["admin", "listings"], queryFn: adminListListings });
}

export function useAdminCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminCreateListing(body),
    onSuccess: (li) =>
      qc.setQueryData<HireListing[]>(["admin", "listings"], (old) => [li, ...(old ?? [])]),
  });
}

export function useAdminUpdateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) =>
      adminUpdateListing(v.id, v.body),
    onSuccess: (li) =>
      qc.setQueryData<HireListing[]>(["admin", "listings"], (old) =>
        old?.map((x) => (x.id === li.id ? li : x)),
      ),
  });
}

export function useAdminRepublishListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminRepublishListing(id),
    onSuccess: (li) =>
      qc.setQueryData<HireListing[]>(["admin", "listings"], (old) =>
        old?.map((x) => (x.id === li.id ? li : x)),
      ),
  });
}

export function useAdminDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteListing(id),
    onSuccess: (_res, id) =>
      qc.setQueryData<HireListing[]>(["admin", "listings"], (old) =>
        old?.filter((x) => x.id !== id),
      ),
  });
}

// --- torneios (admin) ---
export function useAdminTournaments() {
  return useQuery({ queryKey: ["admin", "tournaments"], queryFn: adminListTournaments });
}

export function useAdminTournament(id: string | null) {
  return useQuery({
    queryKey: ["admin", "tournament", id],
    queryFn: () => adminTournamentDetail(id!),
    enabled: !!id,
  });
}

export function useAdminCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminCreateTournament(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tournaments"] }),
  });
}

export function useAdminStartTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminStartTournament(id),
    onSuccess: (detail) => {
      qc.setQueryData(["admin", "tournament", id], detail);
      qc.invalidateQueries({ queryKey: ["admin", "tournaments"] });
    },
  });
}

export function useAdminSetResult(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { mid: string; scoreA: number; scoreB: number }) =>
      adminSetMatchResult(id, v.mid, v.scoreA, v.scoreB),
    onSuccess: (detail) => qc.setQueryData(["admin", "tournament", id], detail),
  });
}

export function useAdminAdvancePhase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminAdvancePhase(id),
    onSuccess: (detail) => qc.setQueryData(["admin", "tournament", id], detail),
  });
}

export function useAdminFinishTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminFinishTournament(id),
    onSuccess: (detail) => {
      qc.setQueryData(["admin", "tournament", id], detail);
      qc.invalidateQueries({ queryKey: ["admin", "tournaments"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] }); // premiação creditada
    },
  });
}

export function useAdminDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteTournament(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tournaments"] }),
  });
}

// --- loja (produtos do CT) ---
export function useAdminProducts() {
  return useQuery({ queryKey: ["admin", "products"], queryFn: adminListProducts });
}

export function useAdminCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminCreateProduct(body),
    onSuccess: (p) =>
      qc.setQueryData<StoreProduct[]>(["admin", "products"], (old) => [p, ...(old ?? [])]),
  });
}

export function useAdminUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) =>
      adminUpdateProduct(v.id, v.body),
    onSuccess: (p) =>
      qc.setQueryData<StoreProduct[]>(["admin", "products"], (old) =>
        old?.map((x) => (x.id === p.id ? p : x)),
      ),
  });
}

export function useAdminDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteProduct(id),
    onSuccess: (_res, id) =>
      qc.setQueryData<StoreProduct[]>(["admin", "products"], (old) =>
        old?.filter((x) => x.id !== id),
      ),
  });
}

// --- odds (apostas) ---
export function useAdminOdds() {
  return useQuery({ queryKey: ["admin", "odds"], queryFn: adminListOdds });
}

export function useAdminOddDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "odd", id],
    queryFn: () => adminOddDetail(id!),
    enabled: !!id,
  });
}

export function useAdminCreateOdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminCreateOdd(body),
    onSuccess: (o) => qc.setQueryData<Odd[]>(["admin", "odds"], (old) => [o, ...(old ?? [])]),
  });
}

export function useAdminUpdateOdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => adminUpdateOdd(v.id, v.body),
    onSuccess: (o) =>
      qc.setQueryData<Odd[]>(["admin", "odds"], (old) => old?.map((x) => (x.id === o.id ? o : x))),
  });
}

export function useAdminSettleOdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; winner: OddSelection }) => adminSettleOdd(v.id, v.winner),
    onSuccess: (o) => {
      qc.setQueryData<Odd[]>(["admin", "odds"], (old) => old?.map((x) => (x.id === o.id ? o : x)));
      qc.invalidateQueries({ queryKey: ["admin", "odd", o.id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] }); // pagou os vencedores
    },
  });
}

export function useAdminCancelOdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminCancelOdd(id),
    onSuccess: (o) => {
      qc.setQueryData<Odd[]>(["admin", "odds"], (old) => old?.map((x) => (x.id === o.id ? o : x)));
      qc.invalidateQueries({ queryKey: ["admin", "odd", o.id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] }); // devolveu apostas
    },
  });
}

export function useAdminDeleteOdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteOdd(id),
    onSuccess: (_res, id) => {
      qc.setQueryData<Odd[]>(["admin", "odds"], (old) => old?.filter((x) => x.id !== id));
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// --- lootbox (caixas) ---
export function useAdminLootboxes() {
  return useQuery({ queryKey: ["admin", "lootboxes"], queryFn: adminListLootboxes });
}

export function useAdminLootboxDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "lootbox", id],
    queryFn: () => adminLootboxDetail(id!),
    enabled: !!id,
  });
}

export function useAdminCreateLootbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminCreateLootbox(body),
    onSuccess: (b) => qc.setQueryData<Lootbox[]>(["admin", "lootboxes"], (old) => [b, ...(old ?? [])]),
  });
}

export function useAdminUpdateLootbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => adminUpdateLootbox(v.id, v.body),
    onSuccess: (b) => {
      qc.setQueryData<Lootbox[]>(["admin", "lootboxes"], (old) => old?.map((x) => (x.id === b.id ? b : x)));
      qc.invalidateQueries({ queryKey: ["admin", "lootbox", b.id] });
    },
  });
}

export function useAdminDeleteLootbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteLootbox(id),
    onSuccess: (_res, id) =>
      qc.setQueryData<Lootbox[]>(["admin", "lootboxes"], (old) => old?.filter((x) => x.id !== id)),
  });
}

export function useAdminAddLootboxItem(boxId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminAddLootboxItem(boxId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "lootbox", boxId] });
      qc.invalidateQueries({ queryKey: ["admin", "lootboxes"] });
    },
  });
}

export function useAdminUpdateLootboxItem(boxId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; probability: number }) =>
      adminUpdateLootboxItem(v.itemId, v.probability),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "lootbox", boxId] }),
  });
}

export function useAdminDeleteLootboxItem(boxId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => adminDeleteLootboxItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "lootbox", boxId] });
      qc.invalidateQueries({ queryKey: ["admin", "lootboxes"] });
    },
  });
}
