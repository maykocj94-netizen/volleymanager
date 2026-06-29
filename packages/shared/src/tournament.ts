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

/** Nome legível da fase de uma partida (Oitavas/Quartas/Semis/Final/3º…). */
export function matchRoundLabel(m: TournamentMatch, matches: TournamentMatch[]): string {
  if (m.stage === "rr") return "Pontos corridos";
  if (m.stage === "group") return `Grupo ${m.group_no ?? ""}`.trim();
  if (m.stage === "bronze") return "Disputa de 3º lugar";
  const rep = m.stage === "rep" || m.stage === "rep_final";
  const koStages = rep ? ["rep", "rep_final"] : ["ko", "final"];
  const totalRounds = matches
    .filter((x) => koStages.includes(x.stage))
    .reduce((mx, x) => Math.max(mx, x.round_no), 0);
  const fromEnd = totalRounds - m.round_no; // 0 = final, 1 = semi, 2 = quartas…
  const prefix = rep ? "Repescagem — " : "";
  const names: Record<number, string> = {
    0: "Final",
    1: "Semifinais",
    2: "Quartas de final",
    3: "Oitavas de final",
    4: "16-avos de final",
  };
  return prefix + (names[fromEnd] ?? `Rodada ${m.round_no}`);
}
