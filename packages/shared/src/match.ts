import type { Modality, Tactic, Weather } from "./enums";

export interface TeamSpec {
  name: string;
  serve: number;
  attack: number;
  block: number;
  defense: number;
  reception: number;
  setting: number;
  players: string[];
  chemistry: number;
  morale: number;
  fatigue: number;
  tactic: Tactic;
}

export interface ExhibitionRequest {
  modality: Modality;
  weather?: Weather | null;
  seed?: number | null;
  home: TeamSpec;
  away: TeamSpec;
}

export interface SetScore {
  set_no: number;
  home: number;
  away: number;
}

export interface MatchEvent {
  set_no: number;
  rally_no: number;
  event_type: string;
  side: "home" | "away" | "info";
  text: string;
  athlete?: string | null;
}

export interface MatchResult {
  home_sets: number;
  away_sets: number;
  winner: "home" | "away";
  sets: SetScore[];
  events: MatchEvent[];
}

// Mensagens do WebSocket de narração ao vivo.
export type WsMessage =
  | { type: "start"; home: string; away: string }
  | ({ type: "event" } & MatchEvent)
  | {
      type: "end";
      home_sets: number;
      away_sets: number;
      winner: "home" | "away";
      sets: SetScore[];
    }
  | { type: "error"; detail: string };
