import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FastForward, Play, RefreshCw, RotateCcw, Timer, Trophy, Users2 } from "lucide-react";
import {
  SCENARIO_REROLL_COST,
  Sex,
  SEX_LABEL,
  Tactic,
  TACTIC_LABEL,
  WEATHER_LABEL,
  type Athlete,
  type CpuInfo,
  type LineupKey,
  type MatchEvent,
  type MatchResult,
  type TimeoutEntry,
} from "@volley/shared";
import {
  postSimulateMatch,
  useClubAthletes,
  useFinishMatch,
  useMe,
  useMyClub,
  useReroll,
  useScenario,
} from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineupEditor } from "@/features/squad/LineupEditor";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 2, 4, 6, 8, 10, 12, 16] as const;
const BASE_MS = 700;

type MatchKind = "beach" | "indoor";
type Status = "idle" | "loading" | "live" | "timeout" | "done" | "error";

function tierTone(tier: string) {
  if (tier === "facil") return "text-emerald-400";
  if (tier === "medio") return "text-brand";
  if (tier === "dificil") return "text-amber-400";
  return "text-red-400";
}

function parseApiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const i = msg.indexOf("{");
  if (i >= 0) {
    try {
      const d = JSON.parse(msg.slice(i)).detail;
      if (typeof d === "string") return d;
    } catch {
      /* usa a mensagem crua */
    }
  }
  return msg;
}

function pickLineup(kind: MatchKind, sex: Sex, squad: Athlete[], ids: string[]) {
  const pool = squad.filter(
    (a) => a.sex === sex && (kind === "beach" ? a.beach_position : a.court_position),
  );
  const chosen = ids.map((id) => pool.find((a) => a.id === id)).filter(Boolean) as Athlete[];
  const need = kind === "beach" ? 2 : 6;
  if (chosen.length >= need) return chosen.slice(0, need);
  const rest = [...pool].sort((a, b) => b.current_ability - a.current_ability).filter((a) => !chosen.includes(a));
  return [...chosen, ...rest].slice(0, need);
}

function deriveScore(events: MatchEvent[]) {
  let home = 0, away = 0, setHome = 0, setAway = 0;
  for (const e of events) {
    if (e.event_type === "set_start") { home = 0; away = 0; }
    else if (e.event_type === "point") { if (e.side === "home") home++; else away++; }
    else if (e.event_type === "set_end") { if (home > away) setHome++; else setAway++; }
  }
  return { home, away, setHome, setAway };
}

export function ExhibitionPage() {
  const { club } = useMyClub();
  const { data: squad } = useClubAthletes(club?.id);
  const { data: me } = useMe();

  const [kind, setKind] = useState<MatchKind>("beach");
  const [sex, setSex] = useState<Sex>(Sex.MALE);
  const [homeTactic, setHomeTactic] = useState<Tactic>(Tactic.BALANCED);
  const [showEditTeam, setShowEditTeam] = useState(false);

  const sexParam = sex === Sex.MALE ? "male" : "female";
  const { data: scenario } = useScenario(kind, sexParam);
  const reroll = useReroll(kind, sexParam);
  const finishMatch = useFinishMatch(club?.id);

  const [result, setResult] = useState<MatchResult | null>(null);
  const [matchCpu, setMatchCpu] = useState<CpuInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimeoutEntry[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [speed, setSpeed] = useState<number>(2);
  const [status, setStatus] = useState<Status>("idle");
  const logRef = useRef<HTMLDivElement>(null);
  const finalizingRef = useRef(false);

  const events = result?.events ?? [];
  const homeName = club?.name ?? "OVER POINT";

  const lineupKey = `${kind}_${sex === Sex.MALE ? "m" : "f"}` as LineupKey;
  const lineupIds = me?.lineup[lineupKey] ?? [];
  const myAthletes = useMemo(
    () => (squad ? pickLineup(kind, sex, squad, lineupIds) : []),
    [squad, kind, sex, lineupIds],
  );

  const shown = events.slice(0, revealed);
  const score = useMemo(() => deriveScore(shown), [shown]);

  const maxTimeouts = kind === "beach" ? 1 : 2;
  const currentSet = useMemo(() => {
    for (let i = shown.length - 1; i >= 0; i--) if (shown[i].set_no > 0) return shown[i].set_no;
    return 1;
  }, [shown]);
  const hasRally = useMemo(() => shown.some((e) => e.rally_no > 0), [shown]);
  const timeoutsThisSet = timeline.filter((t) => t.set_no === currentSet).length;
  const timeoutsLeft = maxTimeouts - timeoutsThisSet;
  const currentTactic = (timeline.length ? timeline[timeline.length - 1].tactic : homeTactic) as Tactic;

  useEffect(() => {
    if (status !== "live") return;
    if (revealed >= events.length) {
      void finalize();
      return;
    }
    const t = setTimeout(() => setRevealed((r) => r + 1), BASE_MS / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, revealed, speed, events.length]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [revealed]);

  async function start() {
    if (!myAthletes.length) return;
    setStatus("loading");
    setResult(null);
    setMatchCpu(null);
    setErrorMsg(null);
    setRevealed(0);
    setTimeline([]);
    setShowEditTeam(false);
    finalizingRef.current = false;
    try {
      const res = await postSimulateMatch({ kind, sex: sexParam, home_tactic: homeTactic, timeline: [] });
      setResult(res.result);
      setMatchCpu(res.cpu);
      setStatus("live");
    } catch (e) {
      setErrorMsg(parseApiError(e));
      setStatus("error");
    }
  }

  async function applyTimeout(tac: Tactic) {
    const lastRally = [...shown].reverse().find((e) => e.rally_no > 0);
    const set_no = lastRally?.set_no ?? 1;
    const rally_no = (lastRally?.rally_no ?? 0) + 1;
    const newTimeline = [...timeline, { set_no, rally_no, tactic: tac }];
    setStatus("loading");
    try {
      const res = await postSimulateMatch({ kind, sex: sexParam, home_tactic: homeTactic, timeline: newTimeline });
      setResult(res.result);
      setTimeline(newTimeline);
      setStatus("live");
    } catch (e) {
      setErrorMsg(parseApiError(e));
      setStatus("live");
    }
  }

  async function finalize() {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    try {
      const res = await finishMatch.mutateAsync({ kind, sex: sexParam, home_tactic: homeTactic, timeline });
      setMatchCpu(res.cpu);
    } catch (e) {
      setErrorMsg(parseApiError(e));
    }
    setStatus("done");
  }

  function skipToResult() {
    if (!result) return;
    setRevealed(result.events.length);
  }

  function reset() {
    setStatus("idle");
    setResult(null);
    setMatchCpu(null);
    setTimeline([]);
    setRevealed(0);
  }

  const awayName = matchCpu?.team_name ?? scenario?.cpu_team ?? "CPU Rivais";
  const winnerName = status === "done" && result ? (result.winner === "home" ? homeName : awayName) : null;
  const running = status === "loading" || status === "live" || status === "timeout";
  const cpuNames = scenario?.cpu_names ?? [];
  const freeLeft = scenario?.free_rerolls_left ?? 0;

  const statusNotes = useMemo(() => {
    if (!matchCpu) return [] as string[];
    const byId = new Map((squad ?? []).map((a) => [a.id, a]));
    return Object.entries(matchCpu.statuses).map(([id, st]) => {
      const a = byId.get(id);
      const nm = a ? `${a.first_name} ${a.last_name}` : "Atleta";
      return `${nm} ficou ${st === "injured" ? "lesionado 🚑" : "fadigado 💤"}`;
    });
  }, [matchCpu, squad]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Partida Single</h1>
        <p className="text-sm text-ink-muted">
          Use seu elenco. Peça tempo para mudar a tática no meio do jogo — o resto da partida muda de verdade.
        </p>
      </header>

      {/* Configuração */}
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <KindButton active={kind === "beach"} onClick={() => setKind("beach")} disabled={running}>
            🏖️ Praia (dupla)
          </KindButton>
          <KindButton active={kind === "indoor"} onClick={() => setKind("indoor")} disabled={running}>
            🏐 Quadra (sexteto)
          </KindButton>
          <span className="mx-1 self-center text-ink-faint">·</span>
          <KindButton active={sex === Sex.MALE} onClick={() => setSex(Sex.MALE)} disabled={running}>
            ♂ Masculino
          </KindButton>
          <KindButton active={sex === Sex.FEMALE} onClick={() => setSex(Sex.FEMALE)} disabled={running}>
            ♀ Feminino
          </KindButton>
        </div>

        {/* Adversário da vez */}
        <div className="mb-4 rounded-lg border border-graphite-border bg-graphite/40 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-ink-faint">Adversário da vez</span>
            {scenario && (
              <span className={cn("text-sm font-bold", tierTone(scenario.tier))}>
                Dificuldade: {scenario.label}
              </span>
            )}
          </div>
          <p className="mt-1 font-semibold">
            {kind === "indoor"
              ? `🏐 Time: ${scenario?.cpu_team ?? "Sorteando…"}`
              : cpuNames.length
                ? cpuNames.map((n, i) => `Atleta ${i + 1}: ${n}`).join("  ·  ")
                : "Sorteando adversário…"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            {scenario && <span>🤖 Tática: {TACTIC_LABEL[scenario.tactic as Tactic]}</span>}
            {scenario && kind === "beach" && (
              <span>🌤️ Clima: {WEATHER_LABEL[scenario.weather as keyof typeof WEATHER_LABEL]}</span>
            )}
            {kind === "indoor" && <span>🏟️ Ginásio coberto</span>}
          </div>
          <div className="mt-3">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => reroll.mutate()}
              disabled={running || reroll.isPending}
              title="Sorteia um novo adversário (clima/dificuldade)"
            >
              <RefreshCw className={cn("h-4 w-4", reroll.isPending && "animate-spin")} />
              Mudar cenário{" "}
              {freeLeft > 0 ? `(${freeLeft} grátis esta semana)` : `(${SCENARIO_REROLL_COST} prata)`}
            </Button>
            {reroll.isError && (
              <span className="ml-3 text-sm text-red-400">Sem prata suficiente para trocar de novo.</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Sua tática inicial"
            value={homeTactic}
            onChange={(v) => setHomeTactic(v as Tactic)}
            options={Object.values(Tactic)}
            labels={TACTIC_LABEL}
            disabled={running}
          />
          <div className="flex flex-col justify-end text-xs text-ink-faint">
            Seu time: {myAthletes.length} atleta(s) — {SEX_LABEL[sex]}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={status === "done" ? reset : start} disabled={running || !myAthletes.length || !scenario} size="lg">
            {status === "idle" && <Play className="h-4 w-4" />}
            {status === "idle"
              ? "Iniciar partida"
              : status === "loading"
                ? "Carregando…"
                : status === "live" || status === "timeout"
                  ? "Em andamento…"
                  : (<><RotateCcw className="h-4 w-4" /> Nova partida</>)}
          </Button>
          <Button variant="subtle" onClick={() => setShowEditTeam((v) => !v)} disabled={running}>
            <Users2 className="h-4 w-4" /> Alterar time
          </Button>
          {status === "live" && (
            <Button
              variant="outline"
              onClick={() => setStatus("timeout")}
              disabled={!hasRally || timeoutsLeft <= 0}
              title={timeoutsLeft <= 0 ? "Pedidos de tempo esgotados neste set" : "Pausar e mudar a tática"}
            >
              <Timer className="h-4 w-4" /> Pedir tempo ({timeoutsLeft} no set)
            </Button>
          )}
          {(status === "live" || status === "done") && (
            <Button variant="subtle" onClick={skipToResult} disabled={status === "done"}>
              <FastForward className="h-4 w-4" /> Resultado da partida
            </Button>
          )}
          {!myAthletes.length && (
            <span className="text-sm text-amber-400">
              Sem atletas {SEX_LABEL[sex].toLowerCase()} de {kind === "beach" ? "praia" : "quadra"} disponíveis.
            </span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-400">{errorMsg ?? "Sem conexão com a API."}</span>
          )}
        </div>

        {/* Painel do pedido de tempo */}
        {status === "timeout" && (
          <div className="mt-4 rounded-lg border border-brand/40 bg-brand/10 p-4">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Timer className="h-4 w-4 text-brand" /> Pedido de tempo — escolha a nova tática
            </p>
            <p className="mb-3 text-xs text-ink-muted">
              Vale do ponto atual ({score.home} x {score.away}) até o fim da partida. Tática atual:{" "}
              <b className="text-ink">{TACTIC_LABEL[currentTactic]}</b>.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.values(Tactic).map((t) => (
                <button
                  key={t}
                  onClick={() => applyTimeout(t)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                    t === currentTactic ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink",
                  )}
                >
                  {TACTIC_LABEL[t]}
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setStatus("live")}>
                Voltar sem mudar
              </Button>
            </div>
          </div>
        )}

        {showEditTeam && (
          <div className="mt-4 rounded-lg border border-graphite-border bg-graphite/40 p-4">
            <p className="mb-3 text-sm text-ink-muted">
              Ajuste sua escalação {SEX_LABEL[sex].toLowerCase()} antes de iniciar:
            </p>
            <LineupEditor athletes={squad ?? []} lockSex={sex} only={kind} />
          </div>
        )}

        {(status === "live" || status === "timeout" || status === "done") && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-ink-faint">Velocidade</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors",
                  speed === s ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Placar */}
      <Card>
        <div className="flex items-center justify-around text-center">
          <SideScore name={homeName} sets={score.setHome} active={status !== "idle"} />
          <div>
            <div className="text-4xl font-black tabular-nums">
              {score.home} <span className="text-ink-faint">x</span> {score.away}
            </div>
            <div className="text-xs uppercase tracking-widest text-ink-faint">ponto do set</div>
          </div>
          <SideScore name={awayName} sets={score.setAway} active={status !== "idle"} badge={scenario?.label} />
        </div>
        {winnerName && (
          <div className="mt-4 space-y-1 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-brand">
              <Trophy className="h-5 w-5" /> {winnerName} venceu por {score.setHome} x {score.setAway}!
            </p>
            {result?.winner === "home" && (matchCpu?.gold_awarded ?? 0) > 0 && (
              <p className="text-sm font-semibold text-amber-400">+{matchCpu?.gold_awarded} 🪙 de ouro pela vitória!</p>
            )}
            {statusNotes.length > 0 && (
              <p className="text-sm text-orange-300">⚠️ {statusNotes.join(" · ")}</p>
            )}
          </div>
        )}
      </Card>

      {/* Narração */}
      <Card>
        <CardHeader>
          <CardTitle>Narração</CardTitle>
          <CardDescription>Acompanhe rally a rally.</CardDescription>
        </CardHeader>
        <div ref={logRef} className="max-h-96 space-y-1 overflow-y-auto pr-1 scroll-smooth">
          {shown.length === 0 && (
            <p className="text-ink-faint">A narração aparecerá aqui ao iniciar a partida.</p>
          )}
          {shown
            .filter((e) => e.event_type !== "point")
            .map((e, i) => (
              <p
                key={i}
                className={cn(
                  "rounded px-2 py-1 text-sm",
                  e.side === "info" && "text-ink-faint",
                  e.event_type === "side_switch" && "italic text-ink-muted",
                  /ACE|PONTO|BLOQUEIO/.test(e.text) && "bg-brand-muted/20 font-medium text-ink",
                )}
              >
                {e.text}
              </p>
            ))}
        </div>
      </Card>
    </div>
  );
}

function KindButton({
  active, onClick, disabled, children,
}: {
  active: boolean; onClick: () => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
        active ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SideScore({
  name, sets, active, badge,
}: {
  name: string; sets: number; active: boolean; badge?: string;
}) {
  return (
    <div className={cn("w-32", !active && "opacity-60")}>
      <p className="truncate font-semibold">{name}</p>
      {badge && (
        <span className="mt-0.5 inline-block rounded bg-graphite px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
          {badge}
        </span>
      )}
      <p className="text-3xl font-black tabular-nums text-brand">{sets}</p>
      <p className="text-xs text-ink-faint">sets</p>
    </div>
  );
}

function Select({
  label, value, onChange, options, labels, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; labels: Record<string, string>; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 rounded-lg border border-graphite-border bg-graphite px-3 text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o} value={o}>{labels[o] ?? o}</option>
        ))}
      </select>
    </label>
  );
}
