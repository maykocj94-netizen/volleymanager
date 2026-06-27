import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tournament, TournamentDetail } from "@volley/shared";
import { api } from "./api";

export const getTournaments = () => api<Tournament[]>("/api/v1/tournaments");
export const getTournament = (id: string) => api<TournamentDetail>(`/api/v1/tournaments/${id}`);
export const postRegister = (id: string, athleteIds: string[]) =>
  api<TournamentDetail>(`/api/v1/tournaments/${id}/register`, {
    method: "POST",
    body: JSON.stringify({ athlete_ids: athleteIds }),
  });

export function useTournaments() {
  return useQuery({ queryKey: ["tournaments"], queryFn: getTournaments });
}

export function useTournament(id: string | null) {
  return useQuery({
    queryKey: ["tournament", id],
    queryFn: () => getTournament(id!),
    enabled: !!id,
  });
}

export function useRegisterTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteIds: string[]) => postRegister(id, athleteIds),
    onSuccess: (detail) => {
      qc.setQueryData(["tournament", id], detail);
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}
