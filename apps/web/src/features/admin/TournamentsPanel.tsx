import { useState } from "react";
import { ArrowLeft, Loader2, Play, Plus, Save, Trash2, Flag } from "lucide-react";
import {
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_TYPE_LABEL,
  type TournamentMatch,
  type TournamentType,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useAdminAdvancePhase,
  useAdminCreateTournament,
  useAdminDeleteTournament,
  useAdminFinishTournament,
  useAdminSetResult,
  useAdminStartTournament,
  useAdminTournament,
  useAdminTournaments,
} from "@/lib/admin";

export function TournamentsPanel() {
  const [manage, setManage] = useState<string | null>(null);
  if (manage) return <Manage id={manage} onBack={() => setManage(null)} />;
  return <Overview onManage={setManage} />;
}

function Overview({ onManage }: { onManage: (id: string) => void }) {
  const { data: tours, isLoading } = useAdminTournaments();
  const del = useAdminDeleteTournament();
  return (
    <div className="space-y-5">
      <CreateForm />
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Torneios ({tours?.length ?? 0})</p>
        {isLoading ? (
          <Spinner />
        ) : !tours?.length ? (
          <Card className="text-ink-muted">Nenhum torneio criado ainda.</Card>
        ) : (
          <div className="space-y-2">
            {tours.map((t) => (
              <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-ink-muted">
                    {TOURNAMENT_TYPE_LABEL[t.type]} · {t.kind === "beach" ? "🏖️" : "🏐"} {t.sex === "male" ? "M" : "F"} ·{" "}
                    {t.entry_count}/{t.slots} · {TOURNAMENT_STATUS_LABEL[t.status]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onManage(t.id)}>Gerir</Button>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)} disabled={del.isPending}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TYPES: TournamentType[] = ["round_robin", "knockout", "groups", "repechage"];

function CreateForm() {
  const create = useAdminCreateTournament();
  const [open, setOpen] = useState(true);
  const [f, setF] = useState({
    title: "", subtitle: "", image_url: "",
    type: "round_robin" as TournamentType, kind: "beach", sex: "male",
    slots: 8, num_groups: 2, teams_per_group: 4, advance_per_group: 2,
    prize_silver_1: 1000, prize_silver_2: 500, prize_silver_3: 200,
    prize_gold_1: 0, prize_gold_2: 0, prize_gold_3: 0,
  });
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    create.mutate(
      {
        ...f,
        title: f.title.trim() || "Torneio",
        subtitle: f.subtitle.trim() || null,
        image_url: f.image_url.trim() || null,
      },
      { onSuccess: () => set("title", "") },
    );
  }

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <p className="flex items-center gap-2 font-semibold"><Plus className="h-5 w-5 text-brand" /> Criar torneio</p>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Título"><input value={f.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="Copa de Verão" /></Field>
            <Field label="Subtítulo (opcional)"><input value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} className="input" /></Field>
            <Field label="Imagem URL (opcional)"><input value={f.image_url} onChange={(e) => set("image_url", e.target.value)} className="input" placeholder="https://…" /></Field>
            <Field label="Formato">
              <select value={f.type} onChange={(e) => set("type", e.target.value)} className="input">
                {TYPES.map((t) => <option key={t} value={t}>{TOURNAMENT_TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Modalidade">
              <select value={f.kind} onChange={(e) => set("kind", e.target.value)} className="input">
                <option value="beach">Praia (dupla)</option>
                <option value="indoor">Quadra (sexteto)</option>
              </select>
            </Field>
            <Field label="Sexo">
              <select value={f.sex} onChange={(e) => set("sex", e.target.value)} className="input">
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </Field>
            {f.type === "groups" ? (
              <>
                <Field label="Nº de grupos"><Num v={f.num_groups} on={(n) => set("num_groups", n)} /></Field>
                <Field label="Times por grupo"><Num v={f.teams_per_group} on={(n) => set("teams_per_group", n)} /></Field>
                <Field label="Classificam por grupo"><Num v={f.advance_per_group} on={(n) => set("advance_per_group", n)} /></Field>
              </>
            ) : (
              <Field label="Nº de vagas (times)"><Num v={f.slots} on={(n) => set("slots", n)} /></Field>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm text-ink-muted">Premiação (prata / ouro)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((p) => (
                <div key={p} className="rounded border border-graphite-border p-2">
                  <p className="mb-1 text-xs font-semibold text-ink-muted">{p}º lugar</p>
                  <div className="flex gap-2">
                    <label className="flex-1 text-[10px] text-ink-faint">🪙 prata
                      <Num v={(f as never)[`prize_silver_${p}`]} on={(n) => set(`prize_silver_${p}`, n)} />
                    </label>
                    <label className="flex-1 text-[10px] text-ink-faint">🥇 ouro
                      <Num v={(f as never)[`prize_gold_${p}`]} on={(n) => set(`prize_gold_${p}`, n)} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar torneio
            </Button>
            {create.isSuccess && <span className="text-sm text-emerald-400">Torneio criado!</span>}
          </div>
          {f.type === "groups" && (
            <p className="text-xs text-ink-faint">
              💡 Grupos: após concluir as partidas de todos os grupos, clique em <b>Gerar fase final</b> (mata-mata dos classificados).
            </p>
          )}
          {f.type === "repechage" && (
            <p className="text-xs text-ink-faint">
              💡 Repescagem: jogue a chave principal até a final; depois <b>Gerar repescagem</b> (chave dos eliminados decide o 3º).
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Manage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useAdminTournament(id);
  const start = useAdminStartTournament(id);
  const advance = useAdminAdvancePhase(id);
  const finish = useAdminFinishTournament(id);
  if (isLoading || !data) return <Spinner />;
  const t = data.tournament;
  const canAdvance = t.status === "running" && (t.type === "groups" || t.type === "repechage");

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar aos torneios
      </button>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{t.title}</p>
          <p className="text-sm text-ink-muted">
            {TOURNAMENT_TYPE_LABEL[t.type]} · {t.entry_count}/{t.slots} times · {TOURNAMENT_STATUS_LABEL[t.status]}
          </p>
        </div>
        <div className="flex gap-2">
          {t.status === "open" && (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              <Play className="h-4 w-4" /> Iniciar (gerar tabela)
            </Button>
          )}
          {canAdvance && (
            <Button variant="subtle" onClick={() => advance.mutate()} disabled={advance.isPending}>
              <Play className="h-4 w-4" />{" "}
              {t.type === "groups" ? "Gerar fase final" : "Gerar repescagem"}
            </Button>
          )}
          {t.status === "running" && (
            <Button variant="outline" onClick={() => finish.mutate()} disabled={finish.isPending}>
              <Flag className="h-4 w-4" /> Finalizar e premiar
            </Button>
          )}
        </div>
      </Card>
      {(start.isError || advance.isError || finish.isError) && (
        <Card className="text-sm text-red-400">
          {errMsg(start.error || advance.error || finish.error)}
        </Card>
      )}
      {finish.isSuccess && t.status === "finished" && (
        <Card className="text-sm text-emerald-400">🏆 Torneio finalizado e premiação creditada!</Card>
      )}

      {/* Times / classificação */}
      <Card>
        <p className="mb-2 font-semibold">Times inscritos ({data.entries.length})</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {data.entries
            .slice()
            .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99) || b.points - a.points)
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded bg-graphite px-3 py-1.5 text-sm">
                <span>{e.team_name}</span>
                <span className="text-xs text-ink-muted">
                  {e.placement ? `${e.placement}º · ` : ""}{e.points} pts · {e.wins}V/{e.losses}D
                </span>
              </div>
            ))}
        </div>
      </Card>

      {/* Partidas com definição de resultado */}
      {data.matches.length > 0 && (
        <Card>
          <p className="mb-2 font-semibold">Partidas — defina os placares</p>
          <div className="space-y-2">
            {data.matches.map((m) => (
              <MatchRow key={m.id} tid={id} m={m} editable={t.status === "running"} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MatchRow({ tid, m, editable }: { tid: string; m: TournamentMatch; editable: boolean }) {
  const setRes = useAdminSetResult(tid);
  const [a, setA] = useState(m.score_a ?? 0);
  const [b, setB] = useState(m.score_b ?? 0);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-graphite/50 px-3 py-2 text-sm">
      <span className={cn("min-w-0 flex-1 truncate", m.winner_entry_id === m.entry_a_id && "font-semibold text-emerald-400")}>
        {m.a_name}
      </span>
      {editable ? (
        <>
          <input type="number" min={0} max={5} value={a} onChange={(e) => setA(Number(e.target.value))}
            className="w-12 rounded border border-graphite-border bg-surface px-1 py-0.5 text-center" />
          <span className="text-ink-faint">x</span>
          <input type="number" min={0} max={5} value={b} onChange={(e) => setB(Number(e.target.value))}
            className="w-12 rounded border border-graphite-border bg-surface px-1 py-0.5 text-center" />
        </>
      ) : (
        <span className="tabular-nums text-ink-muted">{m.status === "done" ? `${m.score_a} x ${m.score_b}` : "—"}</span>
      )}
      <span className={cn("min-w-0 flex-1 truncate text-right", m.winner_entry_id === m.entry_b_id && "font-semibold text-emerald-400")}>
        {m.b_name}
      </span>
      {editable && (
        <Button size="sm" variant="subtle" onClick={() => setRes.mutate({ mid: m.id, scoreA: a, scoreB: b })}
          disabled={setRes.isPending || a === b}>
          <Save className="h-3.5 w-3.5" /> {m.status === "done" ? "Corrigir" : "Salvar"}
        </Button>
      )}
    </div>
  );
}

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const i = m.indexOf("{");
  if (i >= 0) try { return JSON.parse(m.slice(i)).detail ?? m; } catch { /* */ }
  return m;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Num({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <input type="number" min={0} value={v} onChange={(e) => on(Math.max(0, Number(e.target.value) || 0))}
      className="input" />
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
