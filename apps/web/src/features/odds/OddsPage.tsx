import { useState } from "react";
import { Loader2, Ticket, TrendingUp, Check, History, Clock } from "lucide-react";
import {
  oddLabel,
  oddOptions,
  oddPayout,
  type Odd,
  type OddBet,
  type OddCurrency,
} from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/game";
import { useMyBets, useOpenOdds, usePlaceBet } from "@/lib/odds";

function fmtDeadline(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const BET_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "em aberto", cls: "bg-sky-500/20 text-sky-300" },
  won: { label: "ganhou", cls: "bg-emerald-500/20 text-emerald-400" },
  lost: { label: "perdeu", cls: "bg-red-500/20 text-red-400" },
  refunded: { label: "devolvida", cls: "bg-graphite text-ink-muted" },
};

export function OddsPage() {
  const { data: odds, isLoading, isError } = useOpenOdds();
  const { data: myBets } = useMyBets();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Ticket className="h-6 w-6 text-brand" /> BET
          </h1>
          <p className="text-sm text-ink-muted">
            Aposte num confronto e ganhe pelo multiplicador (odd) se acertar. O pagamento
            arredonda sempre para cima.
          </p>
        </div>
        <Button variant="subtle" onClick={() => setShowHistory((v) => !v)}>
          <History className="h-4 w-4" /> Histórico de BET
          {!!myBets?.length && (
            <span className="ml-1 rounded-full bg-brand/20 px-1.5 text-[10px] font-bold text-brand">{myBets.length}</span>
          )}
        </Button>
      </header>

      {showHistory && <History_ bets={myBets ?? []} />}

      {isError ? (
        <Card className="text-ink-muted">Não foi possível carregar as apostas.</Card>
      ) : isLoading ? (
        <Spinner />
      ) : !odds?.length ? (
        <Card className="text-ink-muted">
          Nenhuma aposta aberta no momento. O administrador publica os confrontos.
        </Card>
      ) : (
        <div className="space-y-3">
          {odds.map((o) => (
            <OddCard key={o.id} odd={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OddCard({ odd: o }: { odd: Odd }) {
  const { data: me } = useMe();
  const place = usePlaceBet();
  const [sel, setSel] = useState<string | null>(null);
  const [currency, setCurrency] = useState<OddCurrency>("silver");
  const [amount, setAmount] = useState("");
  const options = oddOptions(o);

  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  const oddValue = options.find((op) => op.key === sel)?.odd ?? 0;
  const potential = sel ? oddPayout(amt, oddValue) : 0;
  const balance = currency === "gold" ? me?.gold ?? 0 : me?.silver ?? 0;
  const closed = !o.betting_open;
  const canBet = !closed && !!sel && amt >= 1 && amt <= balance;

  function bet() {
    if (!sel) return;
    place.mutate(
      { odd_id: o.id, selection: sel, currency, amount: amt },
      { onSuccess: () => setAmount("") },
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-semibold">{o.title}</p>
        {o.description && <p className="text-xs text-ink-muted">{o.description}</p>}
        {o.closes_at && (
          <p className={cn("mt-0.5 flex items-center gap-1 text-[11px]", closed ? "text-amber-400" : "text-ink-faint")}>
            <Clock className="h-3 w-3" />
            {closed ? "Apostas encerradas em " : "Apostas até "}{fmtDeadline(o.closes_at)}
          </p>
        )}
      </div>

      {closed && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          ⏱️ As apostas para este confronto foram encerradas — aguardando o resultado.
        </p>
      )}

      <div className={cn("grid gap-2", options.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {options.map((op) => (
          <SideButton
            key={op.key}
            name={op.label}
            odd={op.odd}
            active={sel === op.key}
            onClick={() => setSel(op.key)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {(["silver", "gold"] as const).map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrency(cur)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm font-semibold",
                currency === cur ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink",
              )}
            >
              {cur === "gold" ? "🥇 Ouro" : "🥈 Prata"}
            </button>
          ))}
        </div>
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink-muted">Valor (saldo: {balance.toLocaleString("pt-BR")})</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex.: 10"
            className="input"
          />
        </label>
        <Button onClick={bet} disabled={place.isPending || !canBet} title={canBet ? "" : "Escolha uma opção e um valor válido"}>
          {place.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          Apostar
        </Button>
      </div>

      {sel && amt >= 1 && (
        <p className="text-sm text-ink-muted">
          Aposta de <b className="text-ink">{amt}</b> em <b className="text-ink">{oddLabel(o, sel)}</b> ({oddValue.toFixed(2)}x) →
          se ganhar, recebe <b className="text-emerald-400">{potential.toLocaleString("pt-BR")} {currency === "gold" ? "🥇" : "🥈"}</b>
        </p>
      )}
      {place.isError && (
        <p className="text-sm text-red-400">
          {String(place.error).includes("402") ? "Saldo insuficiente." : "Não foi possível apostar."}
        </p>
      )}

      {!!o.my_bets.length && (
        <div className="rounded-lg bg-graphite/50 p-2 text-xs text-ink-muted">
          <p className="mb-1 font-semibold text-ink">Suas apostas neste confronto:</p>
          {o.my_bets.map((b) => (
            <p key={b.id}>
              {b.amount} {b.currency === "gold" ? "🥇" : "🥈"} em{" "}
              {b.selection_label || oddLabel(o, b.selection)} ({b.odd_value.toFixed(2)}x) →
              ganharia {oddPayout(b.amount, b.odd_value).toLocaleString("pt-BR")}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function SideButton({
  name, odd, active, onClick,
}: {
  name: string; odd: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-center transition-colors",
        active ? "border-brand bg-brand/10" : "border-graphite-border bg-graphite hover:bg-graphite-light",
      )}
    >
      <span className="flex items-center gap-1 font-semibold">
        {active && <Check className="h-4 w-4 shrink-0 text-brand" />} {name}
      </span>
      <span className="text-xl font-black tabular-nums text-brand">{odd.toFixed(2)}x</span>
    </button>
  );
}

/** Histórico completo de apostas do usuário (todas, com resultado). */
function History_({ bets }: { bets: OddBet[] }) {
  if (!bets.length) {
    return <Card className="text-sm text-ink-muted">Você ainda não fez nenhuma aposta.</Card>;
  }
  const open = bets.filter((b) => b.status === "pending").length;
  const won = bets.filter((b) => b.status === "won");
  const wonTotal = won.reduce((s, b) => s + b.payout, 0);
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Histórico de BET</p>
        <p className="text-xs text-ink-muted">
          {bets.length} no total · {open} em aberto · {won.length} ganha(s)
          {wonTotal > 0 && <> · +{wonTotal.toLocaleString("pt-BR")} recebido</>}
        </p>
      </div>
      <div className="space-y-1.5">
        {bets.map((b) => {
          const stt = BET_STATUS[b.status] ?? BET_STATUS.pending;
          const side = b.selection_label || (b.selection === "a" ? b.team_a_name : b.selection === "b" ? b.team_b_name : b.selection);
          return (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-graphite px-3 py-2 text-sm">
              <span className="min-w-0">
                <b className="truncate">{b.odd_title}</b>{" "}
                <span className="text-ink-muted">· {b.amount} {b.currency === "gold" ? "🥇" : "🥈"} em {side} ({b.odd_value.toFixed(2)}x)</span>
              </span>
              <span className="flex items-center gap-2">
                {b.status === "won" && <span className="text-emerald-400">+{b.payout.toLocaleString("pt-BR")}</span>}
                {b.status === "lost" && <span className="text-red-400">−{b.amount.toLocaleString("pt-BR")}</span>}
                {b.status === "refunded" && <span className="text-ink-muted">devolvido {b.payout.toLocaleString("pt-BR")}</span>}
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", stt.cls)}>{stt.label}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
