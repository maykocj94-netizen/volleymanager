import type { BeachPosition, CourtPosition, Modality, Sex } from "./enums";

export interface AthleteAttributes {
  serve: number;
  attack: number;
  block: number;
  defense: number;
  reception: number;
  setting: number;
  speed: number;
  jump: number;
  stamina: number;
  positioning: number;
  decision: number;
  concentration: number;
  competitiveness: number;
}

export interface Athlete {
  id: string;
  club_id: string | null;
  first_name: string;
  last_name: string;
  country: string;
  city: string | null;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
  handedness: "left" | "right";
  sex: Sex;
  modality: Modality;
  court_position: CourtPosition | null;
  beach_position: BeachPosition | null;
  current_ability: number;
  potential_ability: number;
  morale: number;
  fatigue: number;
  form: number;
  market_value: number;
  sale_value: number;
  wins: number;
  losses: number;
  is_custom: boolean;
  is_injured: boolean;
  level: number;
  level_xp: number;
  condition: AthleteCondition;
  rest_games_left: number;
  injured_until: string | null;
  last_trained_on: string | null;
  for_sale: boolean;
  expires_at: string | null;
  attributes: AthleteAttributes | null;
}

export type AthleteCondition = "ok" | "fatigued" | "injured";

export const CONDITION_LABEL: Record<AthleteCondition, string> = {
  ok: "Pronto",
  fatigued: "Fadigado",
  injured: "Lesionado",
};

/** Treinos disponíveis (1 por dia por atleta). Espelha app/engine/training.py. */
export const TRAININGS: { key: string; label: string; hint: string }[] = [
  { key: "saque", label: "Saque", hint: "+Saque, −Recepção" },
  { key: "recepcao", label: "Recepção", hint: "+Recepção, −Saque" },
  { key: "passe", label: "Passe", hint: "+Levantamento/Posicionamento, −Bloqueio" },
  { key: "levantamento", label: "Levantamento", hint: "+Levantamento, −Resistência" },
  { key: "manchete", label: "Manchete", hint: "+Defesa, −Ataque" },
  { key: "ataque", label: "Ataque", hint: "+Ataque, −Defesa" },
  { key: "cortada", label: "Cortada", hint: "+Ataque/Impulsão, −Recepção" },
  { key: "impulsao", label: "Impulsão", hint: "+Impulsão, −Resistência" },
  { key: "deslocamento", label: "Deslocamento", hint: "+Velocidade, −Impulsão" },
  { key: "defesa", label: "Defesa", hint: "+Defesa/Posicionamento, −Saque" },
];

export interface Club {
  id: string;
  owner_id: string | null;
  name: string;
  short_name: string | null;
  crest_url: string | null;
  country: string;
  city: string | null;
  modality: Modality;
  reputation: number;
  fanbase: number;
  is_cpu: boolean;
}

export const POSITION_LABEL: Record<string, string> = {
  // quadra
  setter: "Levantador",
  opposite: "Oposto",
  outside: "Ponteiro",
  middle: "Central",
  libero: "Líbero",
  // praia
  defender: "Defensor",
  blocker: "Bloqueador",
  universal: "Universal",
};

export const ATTRIBUTE_LABEL: Record<keyof AthleteAttributes, string> = {
  serve: "Saque",
  attack: "Ataque",
  block: "Bloqueio",
  defense: "Defesa",
  reception: "Recepção",
  setting: "Levantamento",
  speed: "Velocidade",
  jump: "Impulsão",
  stamina: "Resistência",
  positioning: "Posicionamento",
  decision: "Tomada de decisão",
  concentration: "Concentração",
  competitiveness: "Mentalidade",
};
