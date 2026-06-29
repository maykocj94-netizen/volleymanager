import { useState } from "react";
import { Loader2, Plus, Trophy, Trash2, Ban, ChevronDown, ChevronUp, Flag, X } from "lucide-react";
import { ODD_TYPE_LABEL, oddLabel, oddOptions, oddPayout, type Odd, type OddType } from "@volley/shared";
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
  const [type, setType] = useState<OddType>("vitoria");
  const [f, setF] = useState({
    title: "",
    description: "",
    team_a_name: "",
    team_a_odd: 1.5,
    team_b_name: "",
    team_b_odd: 2.5,
    multiplier: 2.0,
  });
  const [alts, setAlts] = useState<string[]>(["", ""]);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    const base = { title: f.title.trim() || "Aposta", type, description: f.description.trim() || null };
    const body =
      type === "placar"
        ? { ...base, multiplier: f.multiplier, alternatives: alts.map((a) => a.trim()).filter(Boolean) }
        : {
            ...base,
            team_a_name: f.team_a_name.trim() || "Time A",
            team_a_odd: f.team_a_odd,
            team_b_name: f.team_b_name.trim() || "Time B",
            team_b_odd: f.team_b_odd,
          };
    create.mutate(body, {
      onSuccess: () => {
        set("title", "");
        if (type === "placar") setAlts(["", ""]);
      },
    });
  }

  const validPlacar = alts.map((a) => a.trim()).filter(Boolean).length >= 2;

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
            <Field label="Tipo de aposta">
              <select className="input" value={type} onChange={(e) => setType(e.target.value as OddType)}>
                <option value="vitoria">{ODD_TYPE_LABEL.vitoria}</option>
                <option value="placar">{ODD_TYPE_LABEL.placar}</option>
              </select>
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <input value={f.description} onChange={(e) => set("description", e.target.value)} className="input" placeholder="Detalhes do confronto" />
          </Field>

          {type === "vitoria" ? (
            <>
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
            </>
          ) : (
            <div className="rounded-lg border border-graphite-border p-3 space-y-3">
              <Field label="Multiplicador (odd) — vale para todas as alternativas">
                <OddNum v={f.multiplier} on={(n) => set("multiplier", n)} />
              </Field>
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-muted">Alternativas (mín. 2)</p>
                <div className="space-y-2">
                  {alts.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={a}
                        onChange={(e) => setAlts((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                        className="input flex-1"
                        placeholder={`Alternativa ${i + 1} (ex.: 3 sets)`}
                      />
                      {alts.length > 2 && (
                        <Button size="sm" variant="ghost" onClick={() => setAlts((s) => s.filter((_, j) => j !== i))}>
                          <X className="h-4 w-4 text-red-400" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="subtle" className="mt-2" onClick={() => setAlts((s) => [...s, ""])}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar alternativa
                </Button>
              </div>
              <p className="text-xs text-ink-faint">
                💡 Ex.: aposta de 10 🥈 numa alternativa com odd {f.multiplier.toFixed(2)}x paga{" "}
                <b className="text-ink-muted">{oddPayout(10, f.multiplier)} 🥈</b> se ela acontecer.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={create.isPending || (type === "placar" && !validPlacar)}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publicar aposta
            </Button>
            {create.isSuccess && <span className="text-sm text-emerald-400">Aposta publicada!</span>}
            {create.isError && <span className="text-sm text-red-400">Erro ao publicar (confira os campos).</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function OddRow({ odd: o }: { odd: Odd }) {
  const [open, setOpen] = useState(false);
  const [finalize, setFinalize] = useState(false);
  const settle = useAdminSettleOdd();
  const cancel = useAdminCancelOdd();
  const del = useAdminDeleteOdd();
  const st = STATUS[o.status] ?? STATUS.open;
  const options = oddOptions(o);

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            {o.title}
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", st.cls)}>{st.label}</span>
          </p>
          <p className="text-xs text-ink-muted">
            {ODD_TYPE_LABEL[o.type] ?? o.type} ·{" "}
            {options.map((op) => `${op.label} (${op.odd.toFixed(2)}x)${o.winner === op.key ? " 🏆" : ""}`).join("  ·  ")}
            {" "}· {o.bet_count} aposta(s)
          </p>
        </div>
        <div className="flex gap-2">
          {o.status === "open" && (
            <Button size="sm" onClick={() => setFinalize((v) => !v)}>
              <Flag className="h-4 w-4" /> Finalizar
            </Button>
          )}
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

      {o.status === "open" && finalize && (
        <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
          <p className="text-sm font-semibold">Finalizar aposta — qual foi o resultado?</p>
          <p className="text-xs text-ink-muted">
            Ao escolher, todos que acertaram recebem ceil(valor × odd) na carteira. Não dá para desfazer.
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((op) => (
              <Button
                key={op.key}
                size="sm"
                onClick={() => settle.mutate({ id: o.id, winner: op.key }, { onSuccess: () => setFinalize(false) })}
                disabled={settle.isPending}
              >
                <Trophy className="h-3.5 w-3.5" /> {op.label} ({op.odd.toFixed(2)}x)
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => cancel.mutate(o.id)} disabled={cancel.isPending}>
              <Ban className="h-3.5 w-3.5" /> Cancelar (devolve apostas)
            </Button>
          </div>
          {settle.isError && <p className="text-xs text-red-400">Não foi possível finalizar.</p>}
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
            {oddLabel(o, b.selection)} ({b.odd_value.toFixed(2)}x)
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
