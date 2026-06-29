import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Trophy, Users2, Lock } from "lucide-react";
import {
  matchRoundLabel,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_TYPE_LABEL,
  type Athlete,
  type Tournament,
  type TournamentDetail,
  type TournamentMatch,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useClubAthletes, useMyClub } from "@/lib/game";
import { useRegisterTournament, useTournament, useTournaments } from "@/lib/tournaments";

export function CompetitionsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <Detail id={selected} onBack={() => setSelected(null)} />;
  return <List onOpen={setSelected} />;
}

function statusTone(s: string) {
  if (s === "open") return "bg-emerald-500/20 text-emerald-300";
  if (s === "running") return "bg-amber-500/20 text-amber-400";
  return "bg-graphite text-ink-muted";
}

function Prizes({ t }: { t: Tournament }) {
  const rows: [string, number, number][] = [
    ["🥇 1º", t.prize_silver_1, t.prize_gold_1],
    ["🥈 2º", t.prize_silver_2, t.prize_gold_2],
    ["🥉 3º", t.prize_silver_3, t.prize_gold_3],
  ];
  return (
    <div className="space-y-0.5 text-xs">
      {rows.map(([label, s, g]) => (
        <p key={label} className="text-ink-muted">
          {label}: {s > 0 && <span>🪙 {s.toLocaleString("pt-BR")} prata </span>}
          {g > 0 && <span>· 🥇 {g.toLocaleString("pt-BR")} ouro</span>}
          {s === 0 && g === 0 && <span className="text-ink-faint">—</span>}
        </p>
      ))}
    </div>
  );
}

function List({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: tours, isLoading, isError } = useTournaments();
  if (isError) return <Card className="text-ink-muted">Não foi possível carregar as competições.</Card>;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Competições</h1>
        <p className="text-sm text-ink-muted">Inscreva seu time nos torneios e dispute a premiação.</p>
      </header>
      {isLoading ? (
        <Spinner />
      ) : !tours?.length ? (
        <Card className="text-ink-muted">Nenhum torneio disponível no momento.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((t) => (
            <button key={t.id} onClick={() => onOpen(t.id)} className="card p-4 text-left transition-colors hover:border-brand">
              <div className="flex items-start justify-between gap-2">
                <Trophy className="h-6 w-6 shrink-0 text-brand" />
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", statusTone(t.status))}>
                  {TOURNAMENT_STATUS_LABEL[t.status]}
                </span>
              </div>
              <p className="mt-2 font-bold leading-tight">{t.title}</p>
              {t.subtitle && <p className="text-xs text-ink-faint">{t.subtitle}</p>}
              <p className="mt-1 text-xs text-ink-muted">
                {TOURNAMENT_TYPE_LABEL[t.type]} · {t.kind === "beach" ? "🏖️ Praia" : "🏐 Quadra"} ·{" "}
                {t.sex === "male" ? "Masc" : "Fem"}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                <Users2 className="mr-1 inline h-3 w-3" /> {t.entry_count}/{t.slots} times
              </p>
              <div className="mt-2 border-t border-graphite-border pt-2">
                <Prizes t={t} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useTournament(id);
  if (isLoading || !data) return <Spinner />;
  const t = data.tournament;
  const registered = !!data.my_entry_id;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            {t.subtitle && <p className="text-sm text-ink-muted">{t.subtitle}</p>}
            <p className="mt-1 text-sm text-ink-muted">
              {TOURNAMENT_TYPE_LABEL[t.type]} · {t.kind === "beach" ? "🏖️ Praia (dupla)" : "🏐 Quadra (sexteto)"} ·{" "}
              {t.sex === "male" ? "Masculino" : "Feminino"} · {t.entry_count}/{t.slots} times
            </p>
          </div>
          <span className={cn("rounded px-2 py-1 text-xs font-bold uppercase", statusTone(t.status))}>
            {TOURNAMENT_STATUS_LABEL[t.status]}
          </span>
        </div>
        <div className="mt-3 border-t border-graphite-border pt-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-faint">Premiação</p>
          <Prizes t={t} />
        </div>
      </Card>

      {t.status === "open" && !registered && <RegisterForm detail={data} />}
      {registered && t.status === "open" && (
        <Card className="text-sm text-emerald-400">
          ✅ Você está inscrito! Aguarde o preenchimento das vagas e o início do torneio.
        </Card>
      )}

      {/* Classificação (pontos corridos) */}
      {t.type === "round_robin" && data.entries.length > 0 && (t.status === "running" || t.status === "finished") && (
        <Standings detail={data} />
      )}

      {/* Times inscritos */}
      <Card>
        <p className="mb-2 font-semibold">Times inscritos ({data.entries.length})</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {data.entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded bg-graphite px-3 py-1.5 text-sm">
              <span className={cn(e.id === data.my_entry_id && "font-bold text-brand")}>
                {e.team_name} {e.id === data.my_entry_id && "(você)"}
              </span>
              {e.placement && <span className="text-xs text-amber-400">{e.placement}º lugar</span>}
            </div>
          ))}
          {!data.entries.length && <p className="text-sm text-ink-muted">Nenhum time inscrito ainda.</p>}
        </div>
      </Card>

      {/* Partidas (agrupadas por fase) */}
      {data.matches.length > 0 && <MatchesByRound matches={data.matches} />}
    </div>
  );
}

function MatchesByRound({ matches }: { matches: TournamentMatch[] }) {
  // Agrupa preservando a ordem de aparição (já vêm por round_no, order).
  const groups: { label: string; items: TournamentMatch[] }[] = [];
  for (const m of matches) {
    const label = matchRoundLabel(m, matches);
    let g = groups.find((x) => x.label === label);
    if (!g) { g = { label, items: [] }; groups.push(g); }
    g.items.push(m);
  }
  return (
    <Card>
      <p className="mb-2 font-semibold">Partidas</p>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">{g.label}</p>
            <div className="space-y-1">
              {g.items.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded bg-graphite/50 px-3 py-1.5 text-sm">
                  <span className={cn("min-w-0 flex-1 truncate", m.winner_entry_id === m.entry_a_id && "font-semibold text-emerald-400")}>{m.a_name}</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {m.status === "done" ? `${m.score_a} x ${m.score_b}` : "—"}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-right", m.winner_entry_id === m.entry_b_id && "font-semibold text-emerald-400")}>{m.b_name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Standings({ detail }: { detail: TournamentDetail }) {
  const ranked = useMemo(
    () =>
      [...detail.entries].sort(
        (a, b) =>
          b.points - a.points ||
          b.sets_won - b.sets_lost - (a.sets_won - a.sets_lost) ||
          b.sets_won - a.sets_won,
      ),
    [detail.entries],
  );
  return (
    <Card>
      <p className="mb-2 font-semibold">Classificação</p>
      <div className="space-y-1 text-sm">
        <div className="grid grid-cols-[24px_1fr_40px_40px_48px] gap-2 px-2 text-[10px] uppercase text-ink-faint">
          <span>#</span><span>Time</span><span>Pts</span><span>V/D</span><span>Sets</span>
        </div>
        {ranked.map((e, i) => (
          <div
            key={e.id}
            className={cn(
              "grid grid-cols-[24px_1fr_40px_40px_48px] items-center gap-2 rounded px-2 py-1",
              i < 3 ? "bg-brand/10" : "bg-graphite/40",
              e.id === detail.my_entry_id && "ring-1 ring-brand",
            )}
          >
            <span className="font-bold text-ink-muted">{i + 1}</span>
            <span className="truncate">{e.team_name}</span>
            <span className="font-bold tabular-nums text-brand">{e.points}</span>
            <span className="tabular-nums text-ink-muted">{e.wins}/{e.losses}</span>
            <span className="tabular-nums text-ink-faint">{e.sets_won}-{e.sets_lost}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RegisterForm({ detail }: { detail: TournamentDetail }) {
  const t = detail.tournament;
  const { club } = useMyClub();
  const { data: squad } = useClubAthletes(club?.id);
  const reg = useRegisterTournament(t.id);
  const [picked, setPicked] = useState<string[]>([]);

  const eligible = useMemo(
    () =>
      (squad ?? []).filter(
        (a: Athlete) => a.sex === t.sex && (t.kind === "beach" ? a.beach_position : a.court_position),
      ),
    [squad, t.sex, t.kind],
  );

  function toggle(id: string) {
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < t.team_size ? [...p, id] : p,
    );
  }

  return (
    <Card>
      <p className="font-semibold">Inscrever meu time</p>
      <p className="mb-3 text-sm text-ink-muted">
        Escale <b>{t.team_size}</b> atleta(s) {t.sex === "male" ? "masculinos" : "femininos"} de{" "}
        {t.kind === "beach" ? "praia" : "quadra"}. <Lock className="inline h-3 w-3" />{" "}
        <span className="text-ink-faint">após inscrever, não dá pra trocar.</span>
      </p>
      {!eligible.length ? (
        <p className="text-sm text-amber-400">
          Você não tem atletas elegíveis para esta categoria. Contrate no Mercado.
        </p>
      ) : (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {eligible.map((a) => {
              const on = picked.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "flex items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors",
                    on ? "border-brand bg-brand/10" : "border-graphite-border bg-graphite hover:border-ink-faint",
                  )}
                >
                  <span>{a.first_name} {a.last_name}</span>
                  <span className="text-xs text-ink-muted">HAB {a.current_ability} · LVL {a.level}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={() => reg.mutate(picked)}
              disabled={picked.length !== t.team_size || reg.isPending}
            >
              {reg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Inscrever ({picked.length}/{t.team_size})
            </Button>
            {reg.isError && (
              <span className="text-sm text-red-400">
                {String(reg.error).includes("409") ? "Não foi possível inscrever (vagas/cheio)." : "Erro ao inscrever."}
              </span>
            )}
          </div>
        </>
      )}
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
