import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Challenge, Heartbeat, Lobby } from "@volley/shared";
import { api } from "./api";

export const postHeartbeat = () => api<Heartbeat>("/api/v1/online/heartbeat", { method: "POST" });
export const postChallenge = (body: {
  opponent_id: string;
  kind: string;
  sex: string;
  currency: string;
  amount: number;
}) => api<Challenge>("/api/v1/online/challenge", { method: "POST", body: JSON.stringify(body) });
export const postRespond = (id: string, accept: boolean) =>
  api<Challenge>(`/api/v1/online/challenge/${id}/respond`, {
    method: "POST",
    body: JSON.stringify({ accept }),
  });
export const postCancel = (id: string) =>
  api<Challenge>(`/api/v1/online/challenge/${id}/cancel`, { method: "POST" });
export const getLobby = (id: string) => api<Lobby>(`/api/v1/online/challenge/${id}`);
export const postLineup = (id: string, athleteIds: string[]) =>
  api<Lobby>(`/api/v1/online/challenge/${id}/lineup`, {
    method: "POST",
    body: JSON.stringify({ athlete_ids: athleteIds }),
  });
export const postReady = (id: string) =>
  api<Lobby>(`/api/v1/online/challenge/${id}/ready`, { method: "POST" });

/** Heartbeat: mantém presença e busca convites/sala. Roda em todo o app. */
export function useHeartbeat(enabled = true) {
  return useQuery({
    queryKey: ["online", "hb"],
    queryFn: postHeartbeat,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    enabled,
    staleTime: 0,
  });
}

export function useLobby(id: string | null) {
  return useQuery({
    queryKey: ["online", "lobby", id],
    queryFn: () => getLobby(id!),
    enabled: !!id,
    refetchInterval: 2500,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postChallenge,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "hb"] }),
  });
}

export function useRespond() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; accept: boolean }) => postRespond(v.id, v.accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "hb"] }),
  });
}

export function useCancelChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postCancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["online", "hb"] }),
  });
}

export function useSetLineup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteIds: string[]) => postLineup(id, athleteIds),
    onSuccess: (lobby) => qc.setQueryData(["online", "lobby", id], lobby),
  });
}

export function useReady(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postReady(id),
    onSuccess: (lobby) => {
      qc.setQueryData(["online", "lobby", id], lobby);
      qc.invalidateQueries({ queryKey: ["me"] }); // aposta debitada/creditada
    },
  });
}
