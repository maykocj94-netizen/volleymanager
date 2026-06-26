import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Athlete, HireListing, SaleRequest, UserState } from "@volley/shared";
import { api } from "./api";

// --- chamadas ---
export const getListings = () => api<HireListing[]>("/api/v1/market/listings");
export const postHireListing = (listingId: string, currency: "silver" | "gold" = "silver") =>
  api<{ athlete: Athlete; state: UserState }>("/api/v1/market/hire", {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId, currency }),
  });
export const postListForSale = (athleteId: string) =>
  api<SaleRequest>("/api/v1/market/list-for-sale", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });
export const getMySales = () => api<SaleRequest[]>("/api/v1/market/my-sales");
export const postCancelSale = (requestId: string) =>
  api<UserState>(`/api/v1/market/cancel-sale/${requestId}`, { method: "POST" });

// --- hooks ---
export function useListings() {
  return useQuery({ queryKey: ["market", "listings"], queryFn: getListings });
}

export function useMySales() {
  return useQuery({ queryKey: ["market", "my-sales"], queryFn: getMySales });
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
      qc.invalidateQueries({ queryKey: ["market", "my-sales"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}

export function useCancelSale(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => postCancelSale(requestId),
    onSuccess: (state) => {
      qc.setQueryData(["me"], state);
      qc.invalidateQueries({ queryKey: ["market", "my-sales"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}
