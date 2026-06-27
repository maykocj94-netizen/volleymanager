import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminUser,
  AdminWallet,
  Athlete,
  HireListing,
  Modality,
  SaleRequest,
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

// aprovação de entrada de contas
export const adminApproveUser = (userId: string, approved: boolean) =>
  adminApi<AdminUser>(`/api/v1/admin/users/${userId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approved }),
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
