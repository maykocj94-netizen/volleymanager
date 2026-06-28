// Ecossistema Loja -> Centro de Treinamento (CT).
import type { UserState } from "./user";

export type CtItemType =
  | "terreno"
  | "areia"
  | "poste"
  | "refletor"
  | "mastro"
  | "rede"
  | "bola"
  | "ginasio"
  | "piso";

export type CtKind = "beach" | "indoor";
export type Currency = "silver" | "gold";

/** Catálogo de itens (rótulo + emoji) — espelha engine/ct.py do backend. */
export const CT_ITEMS: { type: CtItemType; label: string; emoji: string }[] = [
  { type: "terreno", label: "Terreno", emoji: "🟫" },
  { type: "areia", label: "Areia", emoji: "🏖️" },
  { type: "poste", label: "Poste", emoji: "🗼" },
  { type: "refletor", label: "Refletor", emoji: "💡" },
  { type: "mastro", label: "Mastro", emoji: "⛵" },
  { type: "rede", label: "Rede", emoji: "🥅" },
  { type: "bola", label: "Bola", emoji: "🏐" },
  { type: "ginasio", label: "Ginásio", emoji: "🏟️" },
  { type: "piso", label: "Piso", emoji: "🔲" },
];

export const CT_ITEM_LABEL: Record<CtItemType, string> = CT_ITEMS.reduce(
  (acc, i) => ({ ...acc, [i.type]: i.label }),
  {} as Record<CtItemType, string>,
);

export const CT_ITEM_EMOJI: Record<CtItemType, string> = CT_ITEMS.reduce(
  (acc, i) => ({ ...acc, [i.type]: i.emoji }),
  {} as Record<CtItemType, string>,
);

export const CT_KIND_LABEL: Record<CtKind, string> = {
  beach: "CT de Praia",
  indoor: "CT de Quadra",
};

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  item_type: CtItemType;
  quantity: number;
  price_silver: number;
  price_gold: number;
  image_url: string | null;
  active: boolean;
  item_label: string;
  item_emoji: string;
}

export interface InventoryItem {
  item_type: CtItemType;
  label: string;
  emoji: string;
  quantity: number;
}

export interface Requirement {
  item_type: CtItemType;
  label: string;
  emoji: string;
  required: number;
  owned: number;
  ok: boolean;
}

export interface TrainingCenter {
  kind: CtKind;
  label: string;
  built: boolean;
  built_at: string | null;
  requirements: Requirement[];
  can_build: boolean;
}

export interface BuyResult {
  state: UserState;
  inventory: InventoryItem[];
  granted_item: CtItemType;
  granted_qty: number;
}

export interface BuildResult {
  center: TrainingCenter;
  centers: TrainingCenter[];
  inventory: InventoryItem[];
  message: string;
}

// --- Câmbio de moedas (1 ouro = 10 prata) ---
/** to_silver: gasta ouro → recebe prata. to_gold: gasta prata → recebe ouro. */
export type ExchangeDirection = "to_silver" | "to_gold";

export const SILVER_PER_GOLD = 10;

export interface ExchangeResult {
  state: UserState;
  silver_delta: number;
  gold_delta: number;
}
