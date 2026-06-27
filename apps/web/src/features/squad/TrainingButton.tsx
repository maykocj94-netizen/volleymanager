import { useState } from "react";
import { Dumbbell, Loader2, X } from "lucide-react";
import { TRAININGS, type Athlete } from "@volley/shared";
import { Button } from "@/components/ui/button";
import { useTrain } from "@/lib/game";

/** Botão "Treinar" + modal com os tipos de treino (1 por dia por atleta). */
export function TrainingButton({
  athlete,
  clubId,
}: {
  athlete: Athlete;
  clubId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const train = useTrain(clubId);
  const today = new Date().toISOString().slice(0, 10);
  const trainedToday = athlete.last_trained_on === today;
  const isListing = !!athlete.listing_id; // atleta de anúncio: não treina

  function pick(training: string) {
    train.mutate(
      { athleteId: athlete.id, training },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
        disabled={trainedToday || isListing}
        title={
          isListing
            ? "Atleta de contratação (anúncio) não pode treinar"
            : trainedToday
              ? "Este atleta já treinou hoje"
              : "Escolher um treino"
        }
      >
        <Dumbbell className="h-4 w-4" />
        {isListing ? "Contratação" : trainedToday ? "Treinou hoje" : "Treinar"}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-graphite-border bg-surface p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">Treinar — {athlete.first_name} {athlete.last_name}</p>
                <p className="text-xs text-ink-muted">Um treino por dia. Melhora um atributo e pode reduzir levemente outro.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TRAININGS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => pick(t.key)}
                  disabled={train.isPending}
                  className="rounded-lg border border-graphite-border bg-graphite px-3 py-2 text-left transition-colors hover:border-brand hover:bg-graphite-light disabled:opacity-50"
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-[10px] text-ink-faint">{t.hint}</p>
                </button>
              ))}
            </div>

            {train.isPending && (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Treinando…
              </p>
            )}
            {train.isError && (
              <p className="mt-3 text-sm text-red-400">
                {String(train.error).includes("409")
                  ? "Este atleta já treinou hoje."
                  : "Não foi possível treinar agora."}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
