import { useLocation, useNavigate } from "react-router-dom";
import { Check, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeartbeat, useRespond } from "@/lib/online";

/**
 * Banner global de desafio online: roda o heartbeat (presença) em todo o jogo e
 * avisa quando chega um convite X1, ou quando sua sala está pronta.
 */
export function ChallengeBanner({ enabled }: { enabled: boolean }) {
  const { data } = useHeartbeat(enabled);
  const respond = useRespond();
  const navigate = useNavigate();
  const onOnlinePage = useLocation().pathname === "/partida-online";

  const incoming = data?.incoming ?? [];
  const activeId = data?.active_id ?? null;
  // Só considera "em andamento" o que ainda exige ação (sala/partida rolando).
  // Partida já encerrada não deve mais aparecer como pendente no banner.
  const activePending = !!activeId && data?.active_status !== "finished";

  if (incoming.length > 0) {
    const c = incoming[0];
    return (
      <Bar>
        <span className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand" />
          <span><b>{c.challenger_name}</b> te desafiou para um X1
            {c.bet_amount > 0 && <> · {c.bet_amount} {c.bet_currency === "gold" ? "🥇" : "🪙"}</>}!
          </span>
        </span>
        <span className="flex gap-2">
          <Button size="sm" onClick={() => respond.mutate({ id: c.id, accept: true }, { onSuccess: () => navigate("/partida-online") })}>
            <Check className="h-4 w-4" /> Aceitar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: c.id, accept: false })}>
            <X className="h-4 w-4" />
          </Button>
        </span>
      </Bar>
    );
  }

  if (activePending && !onOnlinePage) {
    return (
      <Bar>
        <span className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand" /> Sua partida online está em andamento.
        </span>
        <Button size="sm" onClick={() => navigate("/partida-online")}>Ir para a sala</Button>
      </Bar>
    );
  }
  return null;
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/40 bg-brand/15 px-4 py-2 text-sm">
      {children}
    </div>
  );
}
