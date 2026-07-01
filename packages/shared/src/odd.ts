// Sistema de Odds (apostas com multiplicador, criadas pelo dono).
import type { UserState } from "./user";

export type OddType = "vitoria" | "placar";
/** Chave da opção apostada: "a"/"b" (vitória) ou "opt0", "opt1"… (placar). */
export type OddSelection = string;
export type OddCurrency = "silver" | "gold";

export const ODD_TYPE_LABEL: Record<OddType, string> = {
  vitoria: "Vitória (confronto A x B)",
  placar: "Placar (alternativas)",
};

export interface OddOption {
  key: string;
  label: string;
  odd: number;
}

export interface OddBet {
  id: string;
  odd_id: string;
  selection: OddSelection;
  selection_label: string;
  currency: OddCurrency;
  amount: number;
  odd_value: number;
  status: "pending" | "won" | "lost" | "refunded";
  payout: number;
  odd_title: string;
  odd_type: string;
  team_a_name: string;
  team_b_name: string;
  odd_status: string;
  odd_winner: OddSelection | null;
}

export interface Odd {
  id: string;
  title: string;
  type: OddType;
  description: string | null;
  team_a_name: string;
  team_a_odd: number;
  team_b_name: string;
  team_b_odd: number;
  /** Opções unificadas (vitória → A/B; placar → alternativas). */
  options: OddOption[];
  status: "open" | "settled" | "cancelled";
  winner: OddSelection | null;
  closes_at: string | null;
  betting_open: boolean;
  bet_count: number;
  my_bets: OddBet[];
}

export interface PlaceBetResult {
  state: UserState;
  bet: OddBet;
}

// Admin
export interface OddBetAdmin {
  id: string;
  user_id: string;
  selection: OddSelection;
  currency: OddCurrency;
  amount: number;
  odd_value: number;
  status: string;
  payout: number;
}

export interface OddAdminDetail {
  odd: Odd;
  bets: OddBetAdmin[];
}

/** Opções de uma Odd (com fallback A/B para dados antigos sem `options`). */
export function oddOptions(o: Odd): OddOption[] {
  if (o.options && o.options.length) return o.options;
  return [
    { key: "a", label: o.team_a_name, odd: o.team_a_odd },
    { key: "b", label: o.team_b_name, odd: o.team_b_odd },
  ];
}

/** Rótulo legível de uma seleção (key) dentro de uma Odd. */
export function oddLabel(o: Odd, key: string | null): string {
  if (!key) return "";
  return oddOptions(o).find((opt) => opt.key === key)?.label ?? key;
}

/** Pagamento previsto: ceil(valor × multiplicador) — sempre arredonda p/ cima. */
export function oddPayout(amount: number, oddValue: number): number {
  return Math.ceil((Number(amount) || 0) * oddValue);
}
