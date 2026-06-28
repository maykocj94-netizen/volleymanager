// Sistema de Odds (apostas com multiplicador, criadas pelo dono).
import type { UserState } from "./user";

export type OddType = "vitoria";
export type OddSelection = "a" | "b";
export type OddCurrency = "silver" | "gold";

export const ODD_TYPE_LABEL: Record<OddType, string> = {
  vitoria: "Vitória (confronto A x B)",
};

export interface OddBet {
  id: string;
  odd_id: string;
  selection: OddSelection;
  currency: OddCurrency;
  amount: number;
  odd_value: number;
  status: "pending" | "won" | "lost" | "refunded";
  payout: number;
  odd_title: string;
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
  status: "open" | "settled" | "cancelled";
  winner: OddSelection | null;
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

/** Pagamento previsto: ceil(valor × multiplicador) — sempre arredonda p/ cima. */
export function oddPayout(amount: number, oddValue: number): number {
  return Math.ceil((Number(amount) || 0) * oddValue);
}
