import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Athlete,
  AthleteSaleResult,
  HireListing,
  MarketSale,
  UserState,
} from "@volley/shared";
import { api } from "./api";

// --- contratações (anúncios do dono) ---
export const getListings = () => api<HireListing[]>("/api/v1/market/listings");
export const postHireListing = (listingId: string, currency: "silver" | "gold" = "silver") =>
  api<{ athlete: Athlete; state: UserState }>("/api/v1/market/hire", {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId, currency }),
  });

// --- mercado P2P (compra/venda direta entre jogadores, em ouro) ---
export const postListForSale = (athleteId: string) =>
  api<Athlete>("/api/v1/market/list-for-sale", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });
export const postUnlist = (athleteId: string) =>
  api<Athlete>("/api/v1/market/unlist", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });
export const getForSale = () => api<MarketSale[]>("/api/v1/market/for-sale");
export const postBuyAthlete = (athleteId: string) =>
  api<AthleteSaleResult>("/api/v1/market/buy-athlete", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });

// --- hooks ---
export function useListings() {
  return useQuery({ queryKey: ["market", "listings"], queryFn: getListings });
}

export function useForSale() {
  return useQuery({ queryKey: ["market", "for-sale"], queryFn: getForSale });
}

export function useHireListing(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { listingId: string; currency: "silver" | "gold" }) =>
      postHireListing(v.listingId, v.currency),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state);
      qc.invalidateQueries({ queryKey: ["market", "listings"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}

export function useListForSale(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => postListForSale(athleteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
      qc.invalidateQueries({ queryKey: ["market", "for-sale"] });
    },
  });
}

export function useUnlist(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => postUnlist(athleteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
      qc.invalidateQueries({ queryKey: ["market", "for-sale"] });
    },
  });
}

export function useBuyAthlete(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteId: string) => postBuyAthlete(athleteId),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state); // carteira (ouro)
      qc.invalidateQueries({ queryKey: ["market", "for-sale"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}
