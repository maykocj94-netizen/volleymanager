import type { Athlete } from "./athlete";
import type { MatchEvent } from "./match";

export interface OnlineUser {
  user_id: string;
  team_name: string;
  city: string | null;
  reputation: number;
  online_wins: number;
  online_losses: number;
}

export interface ChallengeBrief {
  id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_name: string;
  opponent_name: string;
  kind: "beach" | "indoor";
  sex: "male" | "female";
  bet_currency: "silver" | "gold";
  bet_amount: number;
  status: string;
}

export interface Heartbeat {
  online: OnlineUser[];
  incoming: ChallengeBrief[];
  outgoing: ChallengeBrief[];
  active_id: string | null;
}

export interface Challenge extends ChallengeBrief {
  challenger_athletes: string[];
  opponent_athletes: string[];
  challenger_ready: boolean;
  opponent_ready: boolean;
  winner_id: string | null;
  score_home: number | null;
  score_away: number | null;
  weather: string | null;
  result_text: string | null;
  events: MatchEvent[];
}

export interface Lobby {
  challenge: Challenge;
  challenger_ath: Athlete[];
  opponent_ath: Athlete[];
  me_is_challenger: boolean;
}
