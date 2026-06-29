// Lootbox: caixas de recompensa com sorteio por probabilidade.
import type { Athlete } from "./athlete";
import type { UserState } from "./user";

export type LootboxRarity = "comum" | "raro" | "super_raro" | "lendario";
export type LootboxItemKind = "revelation" | "listing" | "custom";
export type LootboxCurrency = "silver" | "gold";

export const LOOTBOX_RARITY_LABEL: Record<LootboxRarity, string> = {
  comum: "Comum",
  raro: "Raro",
  super_raro: "Super Raro",
  lendario: "Lendário",
};

export const LOOTBOX_RARITY_TONE: Record<LootboxRarity, string> = {
  comum: "bg-graphite text-ink-muted",
  raro: "bg-sky-500/20 text-sky-300",
  super_raro: "bg-fuchsia-500/20 text-fuchsia-300",
  lendario: "bg-amber-500/20 text-amber-300",
};

export interface Lootbox {
  id: string;
  name: string;
  rarity: LootboxRarity;
  description: string | null;
  image_url: string | null;
  cost_currency: LootboxCurrency;
  cost_amount: number;
  item_count: number;
  available_count: number;
  active: boolean;
}

export interface LootboxItem {
  id: string;
  kind: LootboxItemKind;
  probability: number;
  label: string;
  listing_id: string | null;
  claimed: boolean;
  current_ability: number;
}

export interface LootboxDetail {
  box: Lootbox;
  items: LootboxItem[];
}

export interface LootboxInfoListing {
  item_id: string;
  name: string;
  current_ability: number;
  potential_ability: number;
  sex: string;
  age: number;
  court_position: string | null;
  beach_position: string | null;
  attributes: Record<string, number>;
  probability: number;
  claimed: boolean;
}

export interface LootboxInfo {
  id: string;
  name: string;
  rarity: LootboxRarity;
  description: string | null;
  cost_currency: LootboxCurrency;
  cost_amount: number;
  revelation_count: number;
  custom_count: number;
  listings: LootboxInfoListing[];
}

export interface SpinResult {
  state: UserState;
  athlete: Athlete;
  won: { kind: LootboxItemKind; label: string };
}
