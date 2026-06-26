import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUser, AdminWallet, Athlete, Modality } from "@volley/shared";
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminPatchAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { athleteId: string; body: Record<string, unknown> }) =>
      adminPatchAthlete(v.athleteId, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "athletes", userId] }),
  });
}

export function useAdminAddAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modality: Modality) => adminAddAthlete(userId!, modality),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "athletes", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminRemoveAthlete(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => adminRemoveAthlete(athleteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "athletes", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
