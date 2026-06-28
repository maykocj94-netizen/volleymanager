export type TournamentType = "round_robin" | "knockout" | "groups" | "repechage";

export interface Tournament {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  type: TournamentType;
  kind: "beach" | "indoor";
  sex: "male" | "female";
  slots: number;
  num_groups: number;
  teams_per_group: number;
  advance_per_group: number;
  prize_silver_1: number;
  prize_silver_2: number;
  prize_silver_3: number;
  prize_gold_1: number;
  prize_gold_2: number;
  prize_gold_3: number;
  status: "open" | "running" | "finished";
  entry_count: number;
  team_size: number;
}

export interface TournamentEntry {
  id: string;
  user_id: string;
  team_name: string;
  athlete_ids: string[];
  group_no: number | null;
  points: number;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  placement: number | null;
}

export interface TournamentMatch {
  id: string;
  stage: string;
  group_no: number | null;
  round_no: number;
  order: number;
  entry_a_id: string | null;
  entry_b_id: string | null;
  a_name: string;
  b_name: string;
  score_a: number | null;
  score_b: number | null;
  winner_entry_id: string | null;
  status: string;
}

export interface TournamentDetail {
  tournament: Tournament;
  entries: TournamentEntry[];
  matches: TournamentMatch[];
  my_entry_id: string | null;
  athletes: Record<string, import("./athlete").Athlete>;
}

export const TOURNAMENT_TYPE_LABEL: Record<TournamentType, string> = {
  round_robin: "Pontos Corridos",
  knockout: "Mata-mata",
  groups: "Chaves de Grupo",
  repechage: "Repescagem",
};

export const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  open: "Inscrições abertas",
  running: "Em andamento",
  finished: "Encerrado",
};
