// Enums de domínio compartilhados — espelham o backend (app/enums.py) e o SQL.

export const Sex = {
  MALE: "male",
  FEMALE: "female",
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const Modality = {
  BEACH_M: "beach_m",
  BEACH_F: "beach_f",
  INDOOR_M: "indoor_m",
  INDOOR_F: "indoor_f",
} as const;
export type Modality = (typeof Modality)[keyof typeof Modality];

export const Tactic = {
  VERY_OFFENSIVE: "very_offensive",
  OFFENSIVE: "offensive",
  BALANCED: "balanced",
  DEFENSIVE: "defensive",
  VERY_DEFENSIVE: "very_defensive",
} as const;
export type Tactic = (typeof Tactic)[keyof typeof Tactic];

export const Weather = {
  SUNNY: "sunny",
  CLOUDY: "cloudy",
  RAIN: "rain",
  LIGHT_WIND: "light_wind",
  STRONG_WIND: "strong_wind",
} as const;
export type Weather = (typeof Weather)[keyof typeof Weather];

export const CourtPosition = {
  SETTER: "setter",
  OPPOSITE: "opposite",
  OUTSIDE: "outside",
  MIDDLE: "middle",
  LIBERO: "libero",
} as const;
export type CourtPosition = (typeof CourtPosition)[keyof typeof CourtPosition];

export const BeachPosition = {
  DEFENDER: "defender",
  BLOCKER: "blocker",
  UNIVERSAL: "universal",
} as const;
export type BeachPosition = (typeof BeachPosition)[keyof typeof BeachPosition];

// Rótulos em PT-BR para a UI.
export const MODALITY_LABEL: Record<Modality, string> = {
  beach_m: "Praia Masculino",
  beach_f: "Praia Feminino",
  indoor_m: "Quadra Masculino",
  indoor_f: "Quadra Feminino",
};

export const TACTIC_LABEL: Record<Tactic, string> = {
  very_offensive: "Muito Ofensiva",
  offensive: "Ofensiva",
  balanced: "Equilibrada",
  defensive: "Defensiva",
  very_defensive: "Muito Defensiva",
};

export const WEATHER_LABEL: Record<Weather, string> = {
  sunny: "Sol",
  cloudy: "Nublado",
  rain: "Chuva",
  light_wind: "Vento Fraco",
  strong_wind: "Vento Forte",
};

export const SEX_LABEL: Record<Sex, string> = {
  male: "Masculino",
  female: "Feminino",
};
