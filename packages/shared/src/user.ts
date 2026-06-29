import type { AthleteAttributes, Athlete } from "./athlete";
import type { BeachPosition, CourtPosition, Modality, Sex } from "./enums";

export interface Lineup {
  beach_m: string[]; // dupla masculina (2 ids)
  beach_f: string[]; // dupla feminina (2 ids)
  indoor_m: string[]; // sexteto masculino (6 ids)
  indoor_f: string[]; // sexteto feminino (6 ids)
}

/** Chave de categoria de escalação (disciplina × sexo). */
export type LineupKey = "beach_m" | "beach_f" | "indoor_m" | "indoor_f";

export interface UserState {
  silver: number;
  gold: number;
  streak: number;
  last_login: string | null;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  online_wins: number;
  online_losses: number;
  approved: boolean;
  lineup: Lineup;
  club_id: string | null;
  club_name: string | null;
  club_city: string | null;
}

// --- Marketplace de contratações (anúncios do dono) ---
export interface HireListing {
  id: string;
  first_name: string;
  last_name: string;
  country: string;
  sex: Sex;
  modality: Modality;
  court_position: CourtPosition | null;
  beach_position: BeachPosition | null;
  age: number;
  height_cm: number;
  weight_kg: number;
  attributes: Record<string, number>;
  current_ability: number;
  potential_ability: number;
  price: number;
  price_gold: number;
  availability_days: number;
  status: "published" | "hired" | "expired";
  hired_by: string | null;
  expires_at: string | null;
}

// --- Mercado P2P (compra direta entre jogadores, em ouro) ---
export interface MarketSale {
  athlete: Athlete;
  seller_id: string;
  seller_name: string;
  price_gold: number;
}

export interface AthleteSaleResult {
  state: UserState;
  athlete: Athlete;
}

// --- Pedido de venda (aprovação do dono) ---
export interface SaleRequest {
  id: string;
  athlete_id: string;
  seller_id: string;
  price: number;
  status: string;
  athlete_name?: string;
  current_ability?: number;
}

export interface MatchResultReport {
  won: boolean;
  athlete_ids: string[];
}

export interface SellResult {
  value: number;
  state: UserState;
}

export interface SignResult {
  athlete: Athlete;
  state: UserState;
}

export interface CustomAthleteCreate {
  first_name: string;
  last_name: string;
  country: string;
  sex: Sex;
  modality: Modality;
  court_position: CourtPosition | null;
  beach_position: BeachPosition | null;
  height_cm: number;
  weight_kg: number;
  attributes: AthleteAttributes;
}

export interface LoginResult {
  state: UserState;
  bonus_awarded: boolean;
  bonus_amount: number;
}

export interface HireResult {
  athlete: Athlete;
  state: UserState;
}

// --- Cenário da partida (CPU) ---
export interface Scenario {
  tier: string;
  label: string;
  tactic: string;
  weather: string;
  cpu_names: string[];
  cpu_team: string | null;
  free_rerolls_left: number;
  reroll_cost: number;
}

export interface CpuInfo {
  names: string[];
  team_name: string | null;
  tier: string;
  label: string;
  tactic: string;
  weather: string | null;
  gold_awarded: number;
  statuses: Record<string, string>;
}

export interface MatchStartResult {
  result: import("./match").MatchResult;
  cpu: CpuInfo;
  state: UserState;
}

// Pedido de tempo: a partir deste rally (deste set) o mandante muda de tática.
export interface TimeoutEntry {
  set_no: number;
  rally_no: number;
  tactic: string;
}

export interface MatchSimResult {
  result: import("./match").MatchResult;
  cpu: CpuInfo;
}

export interface MatchFinishResult {
  cpu: CpuInfo;
  state: UserState;
}

// --- Admin (central de contas) ---
export interface AdminUser {
  user_id: string;
  email: string | null;
  club_id: string | null;
  club_name: string | null;
  club_city: string | null;
  silver: number;
  gold: number;
  streak: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  online_wins: number;
  online_losses: number;
  athlete_count: number;
  approved: boolean;
}

export interface AdminWallet {
  user_id: string;
  silver: number;
  gold: number;
}

export const HIRE_COST = 1000;
export const LOGIN_STREAK_TARGET = 7;
export const LOGIN_STREAK_BONUS = 3000;
export const SCENARIO_REROLL_COST = 200;
export const SCENARIO_FREE_REROLLS = 3;

// Posições do sexteto de quadra (6 titulares).
export const INDOOR_SLOTS = [
  { key: "setter", label: "Levantador" },
  { key: "opposite", label: "Oposto" },
  { key: "outside", label: "Ponteiro 1" },
  { key: "outside2", label: "Ponteiro 2" },
  { key: "middle", label: "Central 1" },
  { key: "middle2", label: "Central 2" },
] as const;
