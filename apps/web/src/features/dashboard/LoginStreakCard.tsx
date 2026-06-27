import { CalendarPlus, Flame } from "lucide-react";
import { LOGIN_STREAK_BONUS, LOGIN_STREAK_TARGET } from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe, useNextDay } from "@/lib/game";
import { IS_LOCAL_API } from "@/lib/api";

/** Sequência de login diário (fica no topo do Painel). */
export function LoginStreakCard() {
  const { data: me } = useMe();
  const nextDay = useNextDay();
  const streak = me?.streak ?? 0;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Flame className="h-6 w-6 text-brand" />
        <div>
          <p className="font-semibold">
            Sequência de login: {streak}/{LOGIN_STREAK_TARGET} dias
          </p>
          <p className="text-xs text-ink-muted">
            Complete {LOGIN_STREAK_TARGET} dias seguidos e ganhe {LOGIN_STREAK_BONUS.toLocaleString("pt-BR")} de prata.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: LOGIN_STREAK_TARGET }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i < streak ? "bg-brand" : "bg-graphite-border"}`}
            />
          ))}
        </div>
        {IS_LOCAL_API && (
          <Button variant="ghost" size="sm" onClick={() => nextDay.mutate()} disabled={nextDay.isPending}>
            <CalendarPlus className="h-4 w-4" /> Avançar dia (teste)
          </Button>
        )}
      </div>
    </Card>
  );
}
