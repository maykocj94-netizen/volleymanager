import { useState } from "react";
import { Loader2, Ticket, TrendingUp, Check } from "lucide-react";
import {
  oddPayout,
  type Odd,
  type OddBet,
  type OddCurrency,
  type OddSelection,
} from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/game";
import { useMyBets, useOpenOdds, usePlaceBet } from "@/lib/odds";

const BET_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "em aberto", cls: "bg-sky-500/20 text-sky-300" },
  won: { label: "ganhou", cls: "bg-emerald-500/20 text-emerald-400" },
  lost: { label: "perdeu", cls: "bg-red-500/20 text-red-400" },
  refunded: { label: "devolvida", cls: "bg-graphite text-ink-muted" },
};

export function OddsPage() {
  const { data: odds, isLoading, isError } = useOpenOdds();
  const { data: myBets } = useMyBets();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Ticket className="h-6 w-6 text-brand" /> Apostas
        </h1>
        <p className="text-sm text-ink-muted">
          Aposte num confronto e ganhe pelo multiplicador (odd) se acertar. O pagamento
          arredonda sempre para cima.
        </p>
      </header>

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

      {!!myBets?.length && <MyBets bets={myBets} />}
    </div>
  );
}

function OddCard({ odd: o }: { odd: Odd }) {
  const { data: me } = useMe();
  const place = usePlaceBet();
  const [sel, setSel] = useState<OddSelection | null>(null);
  const [currency, setCurrency] = useState<OddCurrency>("silver");
  const [amount, setAmount] = useState("");

  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  const oddValue = sel === "a" ? o.team_a_odd : sel === "b" ? o.team_b_odd : 0;
  const potential = sel ? oddPayout(amt, oddValue) : 0;
  const balance = currency === "gold" ? me?.gold ?? 0 : me?.silver ?? 0;
  const canBet = !!sel && amt >= 1 && amt <= balance;

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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SideButton
          name={o.team_a_name}
          odd={o.team_a_odd}
          active={sel === "a"}
          onClick={() => setSel("a")}
        />
        <SideButton
          name={o.team_b_name}
          odd={o.team_b_odd}
          active={sel === "b"}
          onClick={() => setSel("b")}
        />
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
        <Button onClick={bet} disabled={place.isPending || !canBet} title={canBet ? "" : "Escolha um lado e um valor válido"}>
          {place.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          Apostar
        </Button>
      </div>

      {sel && amt >= 1 && (
        <p className="text-sm text-ink-muted">
          Aposta de <b className="text-ink">{amt}</b> em <b className="text-ink">{sel === "a" ? o.team_a_name : o.team_b_name}</b> ({oddValue.toFixed(2)}x) →
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
              {b.selection === "a" ? o.team_a_name : o.team_b_name} ({b.odd_value.toFixed(2)}x) →
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
        "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 transition-colors",
        active ? "border-brand bg-brand/10" : "border-graphite-border bg-graphite hover:bg-graphite-light",
      )}
    >
      <span className="flex items-center gap-1 font-semibold">
        {active && <Check className="h-4 w-4 text-brand" />} {name}
      </span>
      <span className="text-xl font-black tabular-nums text-brand">{odd.toFixed(2)}x</span>
    </button>
  );
}

function MyBets({ bets }: { bets: OddBet[] }) {
  return (
    <Card>
      <p className="mb-2 font-semibold">Minhas apostas</p>
      <div className="space-y-1.5">
        {bets.map((b) => {
          const st = BET_STATUS[b.status] ?? BET_STATUS.pending;
          const side = b.selection === "a" ? b.team_a_name : b.team_b_name;
          return (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-graphite px-3 py-2 text-sm">
              <span className="min-w-0">
                <b className="truncate">{b.odd_title}</b>{" "}
                <span className="text-ink-muted">· {b.amount} {b.currency === "gold" ? "🥇" : "🥈"} em {side} ({b.odd_value.toFixed(2)}x)</span>
              </span>
              <span className="flex items-center gap-2">
                {b.status === "won" && <span className="text-emerald-400">+{b.payout.toLocaleString("pt-BR")}</span>}
                {b.status === "refunded" && <span className="text-ink-muted">devolvido {b.payout.toLocaleString("pt-BR")}</span>}
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", st.cls)}>{st.label}</span>
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
