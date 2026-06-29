import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Athlete } from "@volley/shared";
import { api } from "./api";

export const getPhysio = () => api<Athlete[]>("/api/v1/physio");
export const postStartPhysio = (athleteId: string) =>
  api<Athlete>("/api/v1/physio/start", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });
export const postCancelPhysio = (athleteId: string) =>
  api<Athlete>("/api/v1/physio/cancel", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });

export function usePhysio() {
  // Recarrega periodicamente para concluir a recuperação quando o tempo acaba.
  return useQuery({ queryKey: ["physio"], queryFn: getPhysio, refetchInterval: 15000 });
}

export function useStartPhysio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => postStartPhysio(athleteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["physio"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club"] });
    },
  });
}

export function useCancelPhysio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => postCancelPhysio(athleteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["physio"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club"] });
    },
  });
}
