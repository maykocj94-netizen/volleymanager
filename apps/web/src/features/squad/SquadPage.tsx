import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import {
  HIRE_COST,
  Modality,
  SEX_LABEL,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  useClubAthletes,
  useHire,
  useMe,
  useMyClub,
} from "@/lib/game";
import { AthleteCard } from "./AthleteCard";
import { LineupEditor } from "./LineupEditor";
import { TrainingButton } from "./TrainingButton";

export function SquadPage() {
  const { club, isLoading: loadingClub, isError } = useMyClub();
  const { data: athletes, isLoading } = useClubAthletes(club?.id);
  const { data: me } = useMe();
  const hire = useHire(club?.id);
  const [hireMod, setHireMod] = useState<Modality>(Modality.BEACH_M);
  const [tab, setTab] = useState<"all" | "beach" | "indoor">("all");

  if (isError) {
    return (
      <Card className="text-ink-muted">
        Não foi possível conectar à API. Rode o backend (porta 8000).
      </Card>
    );
  }
  if (loadingClub) return <Spinner />;

  const beachAthletes = athletes?.filter((a) => a.beach_position) ?? [];
  const indoorAthletes = athletes?.filter((a) => a.court_position) ?? [];
  const visible =
    tab === "beach" ? beachAthletes : tab === "indoor" ? indoorAthletes : (athletes ?? []);
  const canHire = !!me && me.silver >= HIRE_COST;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Elenco — {club?.name}</h1>
          <p className="text-sm text-ink-muted">
            {athletes?.length ?? 0} atletas · {club?.city}, {club?.country}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={hireMod}
            onChange={(e) => setHireMod(e.target.value as Modality)}
            className="h-10 rounded-lg border border-graphite-border bg-graphite px-2 text-sm"
            aria-label="Disciplina da contratação"
          >
            <option value={Modality.BEACH_M}>Praia</option>
            <option value={Modality.INDOOR_M}>Quadra</option>
          </select>
          <Button
            onClick={() => hire.mutate(hireMod)}
            disabled={hire.isPending || !canHire}
            title={canHire ? "" : "Prata insuficiente"}
          >
            {hire.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Contratar revelação ({HIRE_COST} prata)
          </Button>
        </div>
      </header>

      <p className="text-xs text-ink-faint">
        🎲 A revelação vem com <b className="text-ink-muted">sexo aleatório</b> (masculino ou feminino) —
        você escolhe só a disciplina (praia/quadra).
      </p>

      {hire.isSuccess && hire.data && (
        <p className="text-sm text-emerald-400">
          Contratado: {hire.data.athlete.first_name} {hire.data.athlete.last_name} (
          {SEX_LABEL[hire.data.athlete.sex]})!
        </p>
      )}
      {hire.isError && (
        <p className="text-sm text-red-400">
          Prata insuficiente para contratar. Faça login diário para ganhar bônus.
        </p>
      )}

      {/* Construtor de escalação (categorias Masc/Fem) */}
      <Card>
        <CardHeader>
          <CardTitle>Escalações</CardTitle>
          <CardDescription>
            Categorias separadas: na masculina só entram homens; na feminina, só mulheres.
          </CardDescription>
        </CardHeader>
        <LineupEditor athletes={athletes ?? []} />
      </Card>

      {/* Roster */}
      <div>
        <div className="mb-3 flex gap-2">
          {(["all", "beach", "indoor"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                tab === t ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink"
              }`}
            >
              {t === "all" ? "Todos" : t === "beach" ? "Praia" : "Quadra"}
            </button>
          ))}
        </div>
        {isLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <AthleteCard
                key={a.id}
                athlete={a}
                footer={<TrainingButton athlete={a} clubId={club?.id} />}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
