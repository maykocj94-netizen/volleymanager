import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BuildResult,
  BuyResult,
  Currency,
  CtKind,
  ExchangeDirection,
  ExchangeResult,
  InventoryItem,
  StoreProduct,
  TrainingCenter,
} from "@volley/shared";
import { api } from "./api";

// --- chamadas de API (jogador) ---
export const getProducts = () => api<StoreProduct[]>("/api/v1/store/products");
export const getInventory = () => api<InventoryItem[]>("/api/v1/store/inventory");
export const getCenters = () => api<TrainingCenter[]>("/api/v1/store/centers");
export const postBuy = (productId: string, currency: Currency) =>
  api<BuyResult>("/api/v1/store/buy", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, currency }),
  });
export const postBuildCenter = (kind: CtKind) =>
  api<BuildResult>(`/api/v1/store/centers/${kind}/build`, { method: "POST" });
export const postExchange = (direction: ExchangeDirection, amount: number) =>
  api<ExchangeResult>("/api/v1/store/exchange", {
    method: "POST",
    body: JSON.stringify({ direction, amount }),
  });

// --- hooks ---
export function useProducts() {
  return useQuery({ queryKey: ["store", "products"], queryFn: getProducts });
}

export function useInventory() {
  return useQuery({ queryKey: ["store", "inventory"], queryFn: getInventory });
}

export function useCenters() {
  return useQuery({ queryKey: ["store", "centers"], queryFn: getCenters });
}

export function useBuyProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { productId: string; currency: Currency }) =>
      postBuy(v.productId, v.currency),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state); // carteira (Wallet)
      qc.setQueryData(["store", "inventory"], res.inventory);
      // O baú mudou → os requisitos dos CTs também.
      qc.invalidateQueries({ queryKey: ["store", "centers"] });
    },
  });
}

export function useBuildCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: CtKind) => postBuildCenter(kind),
    onSuccess: (res) => {
      qc.setQueryData(["store", "centers"], res.centers);
      qc.setQueryData(["store", "inventory"], res.inventory);
    },
  });
}

export function useExchange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { direction: ExchangeDirection; amount: number }) =>
      postExchange(v.direction, v.amount),
    onSuccess: (res) => qc.setQueryData(["me"], res.state), // atualiza a carteira
  });
}
