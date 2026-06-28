import { useState } from "react";
import { Loader2, Plus, Trophy, Trash2, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { ODD_TYPE_LABEL, oddPayout, type Odd } from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useAdminCancelOdd,
  useAdminCreateOdd,
  useAdminDeleteOdd,
  useAdminOddDetail,
  useAdminOdds,
  useAdminSettleOdd,
} from "@/lib/admin";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "aberta", cls: "bg-emerald-500/20 text-emerald-400" },
  settled: { label: "liquidada", cls: "bg-sky-500/20 text-sky-300" },
  cancelled: { label: "cancelada", cls: "bg-graphite text-ink-muted" },
};

export function OddsPanel() {
  const { data: odds, isLoading } = useAdminOdds();
  return (
    <div className="space-y-5">
      <CreateForm />
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Apostas ({odds?.length ?? 0})</p>
        {isLoading ? (
          <Spinner />
        ) : !odds?.length ? (
          <Card className="text-ink-muted">Nenhuma aposta criada ainda.</Card>
        ) : (
          <div className="space-y-2">
            {odds.map((o) => (
              <OddRow key={o.id} odd={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateForm() {
  const create = useAdminCreateOdd();
  const [open, setOpen] = useState(true);
  const [f, setF] = useState({
    title: "",
    description: "",
    team_a_name: "",
    team_a_odd: 1.5,
    team_b_name: "",
    team_b_odd: 2.5,
  });
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    create.mutate(
      {
        title: f.title.trim() || "Confronto",
        type: "vitoria",
        description: f.description.trim() || null,
        team_a_name: f.team_a_name.trim() || "Time A",
        team_a_odd: f.team_a_odd,
        team_b_name: f.team_b_name.trim() || "Time B",
        team_b_odd: f.team_b_odd,
      },
      { onSuccess: () => set("title", "") },
    );
  }

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <p className="flex items-center gap-2 font-semibold"><Plus className="h-5 w-5 text-brand" /> Criar aposta (Odd)</p>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título da aposta">
              <input value={f.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="Final da Copa de Verão" />
            </Field>
            <Field label="Tipo">
              <select className="input" value="vitoria" disabled>
                <option value="vitoria">{ODD_TYPE_LABEL.vitoria}</option>
              </select>
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <input value={f.description} onChange={(e) => set("description", e.target.value)} className="input" placeholder="Detalhes do confronto" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-graphite-border p-3">
              <p className="mb-2 text-xs font-semibold text-ink-muted">Time A</p>
              <Field label="Nome">
                <input value={f.team_a_name} onChange={(e) => set("team_a_name", e.target.value)} className="input" placeholder="Time A" />
              </Field>
              <Field label="Multiplicador (odd)">
                <OddNum v={f.team_a_odd} on={(n) => set("team_a_odd", n)} />
              </Field>
            </div>
            <div className="rounded-lg border border-graphite-border p-3">
              <p className="mb-2 text-xs font-semibold text-ink-muted">Time B</p>
              <Field label="Nome">
                <input value={f.team_b_name} onChange={(e) => set("team_b_name", e.target.value)} className="input" placeholder="Time B" />
              </Field>
              <Field label="Multiplicador (odd)">
                <OddNum v={f.team_b_odd} on={(n) => set("team_b_odd", n)} />
              </Field>
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            💡 Ex.: aposta de 10 🥈 no Time B com odd {f.team_b_odd.toFixed(2)}x paga{" "}
            <b className="text-ink-muted">{oddPayout(10, f.team_b_odd)} 🥈</b> se o Time B vencer (arredonda para cima).
          </p>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publicar aposta
            </Button>
            {create.isSuccess && <span className="text-sm text-emerald-400">Aposta publicada!</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function OddRow({ odd: o }: { odd: Odd }) {
  const [open, setOpen] = useState(false);
  const settle = useAdminSettleOdd();
  const cancel = useAdminCancelOdd();
  const del = useAdminDeleteOdd();
  const st = STATUS[o.status] ?? STATUS.open;

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            {o.title}
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", st.cls)}>{st.label}</span>
          </p>
          <p className="text-xs text-ink-muted">
            {o.team_a_name} ({o.team_a_odd.toFixed(2)}x){" "}
            {o.winner === "a" && "🏆"} <span className="text-ink-faint">x</span>{" "}
            {o.team_b_name} ({o.team_b_odd.toFixed(2)}x) {o.winner === "b" && "🏆"} · {o.bet_count} aposta(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Apostas
          </Button>
          {o.status !== "settled" && (
            <Button size="sm" variant="ghost" onClick={() => del.mutate(o.id)} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          )}
        </div>
      </div>

      {o.status === "open" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-graphite-border pt-2">
          <span className="text-xs text-ink-muted">Definir vencedor e pagar:</span>
          <Button size="sm" onClick={() => settle.mutate({ id: o.id, winner: "a" })} disabled={settle.isPending}>
            <Trophy className="h-3.5 w-3.5" /> {o.team_a_name}
          </Button>
          <Button size="sm" onClick={() => settle.mutate({ id: o.id, winner: "b" })} disabled={settle.isPending}>
            <Trophy className="h-3.5 w-3.5" /> {o.team_b_name}
          </Button>
          <Button size="sm" variant="outline" onClick={() => cancel.mutate(o.id)} disabled={cancel.isPending}>
            <Ban className="h-3.5 w-3.5" /> Cancelar (devolve apostas)
          </Button>
        </div>
      )}

      {open && <OddBets oddId={o.id} />}
    </Card>
  );
}

function OddBets({ oddId }: { oddId: string }) {
  const { data, isLoading } = useAdminOddDetail(oddId);
  if (isLoading) return <p className="py-2 text-xs text-ink-faint">Carregando apostas…</p>;
  if (!data?.bets.length) return <p className="py-2 text-xs text-ink-faint">Ninguém apostou ainda.</p>;
  const o = data.odd;
  const total = data.bets.reduce((s, b) => s + b.amount, 0);
  return (
    <div className="space-y-1 border-t border-graphite-border pt-2 text-xs">
      <p className="text-ink-muted">{data.bets.length} aposta(s) · total apostado {total}</p>
      {data.bets.map((b) => (
        <div key={b.id} className="flex items-center justify-between rounded bg-graphite/50 px-2 py-1">
          <span className="truncate text-ink-muted">
            {b.user_id.slice(0, 8)}… · {b.amount} {b.currency === "gold" ? "🥇" : "🥈"} em{" "}
            {b.selection === "a" ? o.team_a_name : o.team_b_name} ({b.odd_value.toFixed(2)}x)
          </span>
          <span className={cn(
            b.status === "won" && "text-emerald-400",
            b.status === "lost" && "text-red-400",
            b.status === "refunded" && "text-ink-muted",
          )}>
            {b.status === "pending" ? `→ ${oddPayout(b.amount, b.odd_value)}` : b.status === "won" ? `+${b.payout}` : b.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function OddNum({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <input
      type="number"
      min={1}
      step={0.01}
      value={v}
      onChange={(e) => on(Math.max(1, Number(e.target.value) || 1))}
      className="input"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
