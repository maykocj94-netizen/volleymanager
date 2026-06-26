import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Athlete,
  Club,
  CustomAthleteCreate,
  HireResult,
  Lineup,
  LoginResult,
  MatchFinishResult,
  MatchResultReport,
  MatchSimResult,
  Modality,
  Scenario,
  SellResult,
  SignResult,
  TimeoutEntry,
  UserState,
} from "@volley/shared";
import { api } from "./api";

type MatchKind = "beach" | "indoor";
type SexParam = "male" | "female";

// --- chamadas de API ---
export const getMyClubs = () => api<Club[]>("/api/v1/clubs/mine");
export const getClubAthletes = (clubId: string) =>
  api<Athlete[]>(`/api/v1/athletes/club/${clubId}`);
export const getFreeAgents = (modality: Modality) =>
  api<Athlete[]>(`/api/v1/athletes/free?modality=${modality}`);
export const generateAthletes = (body: {
  modality: Modality;
  count: number;
  club_id?: string | null;
}) =>
  api<Athlete[]>("/api/v1/athletes/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getMe = () => api<UserState>("/api/v1/me");
export const postDailyLogin = () =>
  api<LoginResult>("/api/v1/me/login", { method: "POST" });
export const postNextDay = () =>
  api<LoginResult>("/api/v1/me/dev/next-day", { method: "POST" });
export const putLineup = (lineup: Lineup) =>
  api<UserState>("/api/v1/me/lineup", { method: "PUT", body: JSON.stringify(lineup) });
export const postHire = (modality: Modality) =>
  api<HireResult>("/api/v1/me/hire", {
    method: "POST",
    body: JSON.stringify({ modality }),
  });
export const postMatchResult = (report: MatchResultReport) =>
  api<UserState>("/api/v1/me/match-result", {
    method: "POST",
    body: JSON.stringify(report),
  });
export const postSellAthlete = (athleteId: string) =>
  api<SellResult>("/api/v1/me/sell", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });
export const getCustomAthletes = () => api<Athlete[]>("/api/v1/athletes/custom");
export const postCustomAthlete = (body: CustomAthleteCreate) =>
  api<Athlete>("/api/v1/athletes/custom", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const postSignCustom = (athleteId: string) =>
  api<SignResult>("/api/v1/me/sign-custom", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });

export const postTrain = (athleteId: string, training: string) =>
  api<{ athlete: Athlete }>("/api/v1/me/train", {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId, training }),
  });

export const getScenario = (kind: MatchKind, sex: SexParam) =>
  api<Scenario>(`/api/v1/me/scenario?kind=${kind}&sex=${sex}`);
export const postReroll = (kind: MatchKind, sex: SexParam) =>
  api<Scenario>(`/api/v1/me/scenario/reroll?kind=${kind}&sex=${sex}`, { method: "POST" });
export const postSimulateMatch = (body: {
  kind: MatchKind;
  sex: SexParam;
  home_tactic: string;
  timeline: TimeoutEntry[];
}) =>
  api<MatchSimResult>("/api/v1/me/match/simulate", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postFinishMatch = (body: {
  kind: MatchKind;
  sex: SexParam;
  home_tactic: string;
  timeline: TimeoutEntry[];
}) =>
  api<MatchFinishResult>("/api/v1/me/match/finish", {
    method: "POST",
    body: JSON.stringify(body),
  });

// --- hooks ---
export function useMyClubs() {
  return useQuery({ queryKey: ["clubs", "mine"], queryFn: getMyClubs });
}

export function useMyClub() {
  const q = useMyClubs();
  return { ...q, club: q.data?.find((c) => !c.is_cpu) ?? q.data?.[0] ?? null };
}

export function useClubAthletes(clubId: string | undefined) {
  return useQuery({
    queryKey: ["athletes", "club", clubId],
    queryFn: () => getClubAthletes(clubId!),
    enabled: !!clubId,
  });
}

export function useFreeAgents(modality: Modality) {
  return useQuery({
    queryKey: ["athletes", "free", modality],
    queryFn: () => getFreeAgents(modality),
  });
}

export function useGenerateAthletes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateAthletes,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["athletes", "club", vars.club_id] });
      qc.invalidateQueries({ queryKey: ["athletes", "free"] });
    },
  });
}

// --- estado do jogador (carteira, login, escalação) ---
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: getMe });
}

export function useSaveLineup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putLineup,
    onSuccess: (state) => qc.setQueryData(["me"], state),
  });
}

export function useHire(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modality: Modality) => postHire(modality),
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state);
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}

export function useNextDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postNextDay,
    onSuccess: (res) => qc.setQueryData(["me"], res.state),
  });
}

export function useReportMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postMatchResult,
    onSuccess: (state) => {
      qc.setQueryData(["me"], state);
      // O desempenho/valor dos atletas muda — recarrega o elenco.
      qc.invalidateQueries({ queryKey: ["athletes", "club"] });
    },
  });
}

export function useSellAthlete(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postSellAthlete,
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state);
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}

export function useCustomAthletes() {
  return useQuery({ queryKey: ["athletes", "custom"], queryFn: getCustomAthletes });
}

export function useCreateCustom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postCustomAthlete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athletes", "custom"] }),
  });
}

export function useSignCustom(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postSignCustom,
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state);
      qc.invalidateQueries({ queryKey: ["athletes", "custom"] });
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}

// --- cenário e partida ---
export function useScenario(kind: MatchKind, sex: SexParam) {
  return useQuery({
    queryKey: ["scenario", kind, sex],
    queryFn: () => getScenario(kind, sex),
    staleTime: Infinity, // estável; só muda ao trocar de cenário
  });
}

export function useReroll(kind: MatchKind, sex: SexParam) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postReroll(kind, sex),
    onSuccess: (scenario) => {
      // O cenário é o mesmo para todas as categorias — atualiza todas.
      qc.invalidateQueries({ queryKey: ["scenario"] });
      qc.setQueryData(["scenario", kind, sex], scenario);
      qc.invalidateQueries({ queryKey: ["me"] }); // prata pode ter mudado
    },
  });
}

export function useFinishMatch(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postFinishMatch,
    onSuccess: (res) => {
      qc.setQueryData(["me"], res.state);
      qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] });
    },
  });
}

export function useTrain(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ athleteId, training }: { athleteId: string; training: string }) =>
      postTrain(athleteId, training),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athletes", "club", clubId] }),
  });
}
