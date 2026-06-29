import { useEffect, useState } from "react";
import { Loader2, HeartPulse, Activity, X } from "lucide-react";
import type { Athlete } from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConditionBadge } from "@/features/squad/AthleteCard";
import { useCancelPhysio, usePhysio, useStartPhysio } from "@/lib/physio";

/** Tempo restante legível até `until` (com base em `now`). */
function remaining(until: string, now: number): string {
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return "concluindo…";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

export function FisioterapiaPage() {
  const { data: list, isLoading, isError } = usePhysio();
  const start = useStartPhysio();
  const cancel = useCancelPhysio();
  const [now, setNow] = useState(Date.now());

  // Relógio para os contadores regressivos.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const inPhysio = (list ?? []).filter((a) => a.physio_until);
  const available = (list ?? []).filter(
    (a) => !a.physio_until && (a.condition === "fatigued" || a.condition === "injured"),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <HeartPulse className="h-6 w-6 text-brand" /> Fisioterapia
        </h1>
        <p className="text-sm text-ink-muted">
          Recupere atletas fadigados ou lesionados. <b className="text-ink">Fadiga</b> some em{" "}
          <b className="text-ink">5 minutos</b>; <b className="text-ink">lesão</b> em{" "}
          <b className="text-ink">até 12 horas</b>.
        </p>
      </header>

      {isError ? (
        <Card className="text-ink-muted">Não foi possível carregar a fisioterapia.</Card>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* Em recuperação */}
          <Card>
            <p className="mb-3 flex items-center gap-2 font-semibold">
              <Activity className="h-5 w-5 text-brand" /> Em recuperação ({inPhysio.length})
            </p>
            {!inPhysio.length ? (
              <p className="text-sm text-ink-muted">Nenhum atleta em recuperação agora.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {inPhysio.map((a) => (
                  <div key={a.id} className="rounded-lg border border-brand/30 bg-brand/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{a.first_name} {a.last_name}</span>
                      <ConditionBadge athlete={a} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-emerald-300">
                        ⏳ {a.physio_until ? remaining(a.physio_until, now) : ""}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(a.id)} disabled={cancel.isPending}>
                        <X className="h-4 w-4" /> Tirar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Disponíveis para fisioterapia */}
          <Card>
            <p className="mb-3 font-semibold">Precisam de cuidados ({available.length})</p>
            {!available.length ? (
              <p className="text-sm text-ink-muted">
                Nenhum atleta fadigado ou lesionado no elenco. 👍
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {available.map((a) => (
                  <AvailableRow
                    key={a.id}
                    athlete={a}
                    busy={start.isPending}
                    onStart={() => start.mutate(a.id)}
                  />
                ))}
              </div>
            )}
            {start.isError && <p className="mt-2 text-sm text-red-400">Não foi possível iniciar.</p>}
          </Card>
        </>
      )}
    </div>
  );
}

function AvailableRow({
  athlete: a, busy, onStart,
}: {
  athlete: Athlete; busy: boolean; onStart: () => void;
}) {
  const injured = a.condition === "injured";
  return (
    <div className={cn("rounded-lg border border-graphite-border bg-graphite/40 p-3")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{a.first_name} {a.last_name}</span>
        <ConditionBadge athlete={a} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">
          {injured ? "Recupera em até 12h" : "Recupera em 5 min"}
        </span>
        <Button size="sm" onClick={onStart} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
          Iniciar
        </Button>
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
