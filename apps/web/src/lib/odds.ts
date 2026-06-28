import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Odd, OddBet, OddCurrency, OddSelection, PlaceBetResult } from "@volley/shared";
import { api } from "./api";

export const getOpenOdds = () => api<Odd[]>("/api/v1/odds");
export const getMyBets = () => api<OddBet[]>("/api/v1/odds/my-bets");
export const postBet = (body: {
  odd_id: string;
  selection: OddSelection;
  currency: OddCurrency;
  amount: number;
}) => api<PlaceBetResult>("/api/v1/odds/bet", { method: "POST", body: JSON.stringify(body) });

export function useOpenOdds() {
  return useQuery({ queryKey: ["odds", "open"], queryFn: getOpenOdds });
}

export function useMyBets() {
  return useQuery({ queryKey: ["odds", "my-bets"], queryFn: getMyBets });
}

export function usePlaceBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postBet,
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state); // carteira
      qc.invalidateQueries({ queryKey: ["odds", "open"] });
      qc.invalidateQueries({ queryKey: ["odds", "my-bets"] });
    },
  });
}
