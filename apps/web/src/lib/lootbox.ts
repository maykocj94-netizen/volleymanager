import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Lootbox, LootboxInfo, SpinResult } from "@volley/shared";
import { api } from "./api";

export const getLootboxes = () => api<Lootbox[]>("/api/v1/lootboxes");
export const getLootboxInfo = (id: string) => api<LootboxInfo>(`/api/v1/lootboxes/${id}/info`);
export const postSpin = (id: string) =>
  api<SpinResult>(`/api/v1/lootboxes/${id}/spin`, { method: "POST" });

export function useLootboxes() {
  return useQuery({ queryKey: ["lootboxes"], queryFn: getLootboxes });
}

export function useLootboxInfo(id: string | null) {
  return useQuery({
    queryKey: ["lootbox", "info", id],
    queryFn: () => getLootboxInfo(id!),
    enabled: !!id,
  });
}

export function useSpin(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postSpin(id),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state); // carteira
      qc.invalidateQueries({ queryKey: ["lootboxes"] });
      qc.invalidateQueries({ queryKey: ["lootbox", "info"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}
