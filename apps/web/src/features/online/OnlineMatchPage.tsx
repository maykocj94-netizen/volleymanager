import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Swords, Trophy, Users2, X, Check, Coins, Flag, FastForward,
} from "lucide-react";
import {
  type Athlete,
  type Challenge,
  type ChallengeBrief,
  type MatchEvent,
  type OnlineUser,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useClubAthletes, useMe, useMyClub } from "@/lib/game";
import {
  useCancelChallenge,
  useCreateChallenge,
  useHeartbeat,
  useLobby,
  useReady,
  useRespond,
  useSetLineup,
} from "@/lib/online";
import { AthleteDetail } from "@/features/squad/AthleteCard";

export function OnlineMatchPage() {
  const hb = useHeartbeat();
  const activeId = hb.data?.active_id ?? null;
  // Permite sair da sala/resultado sem esperar o servidor expirar o desafio.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showLobby = activeId && activeId !== dismissed;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Partida Online (X1)</h1>
        <p className="text-sm text-ink-muted">Desafie outros treinadores e aposte moedas. O vencedor leva tudo.</p>
      </header>
      {showLobby ? (
        <LobbyView key={activeId} id={activeId} onLeave={() => setDismissed(activeId)} />
      ) : (
        <OnlineList hb={hb.data} />
      )}
    </div>
  );
}

function OnlineList({ hb }: { hb: ReturnType<typeof useHeartbeat>["data"] }) {
  const respond = useRespond();
  const cancel = useCancelChallenge();
  const [target, setTarget] = useState<OnlineUser | null>(null);

  return (
    <>
      {target && <ChallengeDialog user={target} onClose={() => setTarget(null)} />}

      {/* Convites recebidos */}
      {!!hb?.incoming.length && (
        <Card>
          <p className="mb-2 font-semibold text-brand">⚔️ Você foi desafiado!</p>
          <div className="space-y-2">
            {hb.incoming.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-graphite px-3 py-2 text-sm">
                <span>
                  <b>{c.challenger_name}</b> · {c.kind === "beach" ? "🏖️ Praia" : "🏐 Quadra"} {c.sex === "male" ? "M" : "F"}
                  {c.bet_amount > 0 && <> · aposta {c.bet_amount} {c.bet_currency === "gold" ? "🥇" : "🪙"}</>}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respond.mutate({ id: c.id, accept: true })} disabled={respond.isPending}>
                    <Check className="h-4 w-4" /> Aceitar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: c.id, accept: false })}>
                    <X className="h-4 w-4" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Convites enviados */}
      {!!hb?.outgoing.length && (
        <Card>
          <p className="mb-2 text-sm text-ink-muted">⏳ Aguardando resposta…</p>
          {hb.outgoing.map((c: ChallengeBrief) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span>Desafio enviado a <b>{c.opponent_name}</b></span>
              <Button size="sm" variant="ghost" onClick={() => cancel.mutate(c.id)}>Cancelar</Button>
            </div>
          ))}
        </Card>
      )}

      {/* Usuários online */}
      <Card>
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <Users2 className="h-5 w-5 text-brand" /> Treinadores online ({hb?.online.length ?? 0})
        </p>
        {!hb?.online.length ? (
          <p className="text-sm text-ink-muted">Ninguém online agora. Deixe esta aba aberta — outros aparecerão aqui.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {hb.online.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between rounded-lg border border-graphite-border bg-graphite px-3 py-2">
                <div>
                  <p className="font-semibold">{u.team_name}</p>
                  <p className="text-xs text-ink-muted">
                    {u.city ?? "—"} · Rep {u.reputation} · {u.online_wins}V/{u.online_losses}D online
                  </p>
                </div>
                <Button size="sm" onClick={() => setTarget(u)}>
                  <Swords className="h-4 w-4" /> Desafiar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function ChallengeDialog({ user, onClose }: { user: OnlineUser; onClose: () => void }) {
  const { data: me } = useMe();
  const create = useCreateChallenge();
  const [kind, setKind] = useState("beach");
  const [sex, setSex] = useState("male");
  const [currency, setCurrency] = useState("silver");
  const [amount, setAmount] = useState(0);
  const balance = currency === "gold" ? me?.gold ?? 0 : me?.silver ?? 0;

  function send() {
    create.mutate(
      { opponent_id: user.user_id, kind, sex, currency, amount },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl border border-graphite-border bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Desafiar {user.team_name}</p>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Modalidade" value={kind} onChange={setKind} opts={[["beach", "Praia (dupla)"], ["indoor", "Quadra (sexteto)"]]} />
          <Sel label="Sexo" value={sex} onChange={setSex} opts={[["male", "Masculino"], ["female", "Feminino"]]} />
          <Sel label="Moeda da aposta" value={currency} onChange={setCurrency} opts={[["silver", "🪙 Prata"], ["gold", "🥇 Ouro"]]} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted">Valor (você tem {balance})</span>
            <input type="number" min={0} max={balance} value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.min(balance, Number(e.target.value) || 0)))}
              className="input" />
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Os dois apostam a mesma quantia; o vencedor leva o total ({amount > 0 ? amount * 2 : 0}).
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={send} disabled={create.isPending} className="flex-1">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Enviar desafio
          </Button>
        </div>
        {create.isError && (
          <p className="mt-2 text-sm text-red-400">
            {String(create.error).includes("409") ? "Você já tem um desafio em andamento." : "Erro ao desafiar."}
          </p>
        )}
      </div>
    </div>
  );
}

function LobbyView({ id, onLeave }: { id: string; onLeave: () => void }) {
  const { data: lobby, isLoading } = useLobby(id);
  const cancel = useCancelChallenge();
  const [detail, setDetail] = useState<Athlete | null>(null);
  if (isLoading || !lobby) return <Spinner />;

  const c = lobby.challenge;
  const meChal = lobby.me_is_challenger;
  const myAth = meChal ? lobby.challenger_ath : lobby.opponent_ath;
  const theirAth = meChal ? lobby.opponent_ath : lobby.challenger_ath;
  const myReady = meChal ? c.challenger_ready : c.opponent_ready;
  const theirReady = meChal ? c.opponent_ready : c.challenger_ready;
  const myName = meChal ? c.challenger_name : c.opponent_name;
  const theirName = meChal ? c.opponent_name : c.challenger_name;
  const teamSize = c.kind === "beach" ? 2 : 6;
  const finished = c.status === "finished";
  const iWon = finished && c.winner_id != null && ((meChal && c.winner_id === c.challenger_id) || (!meChal && c.winner_id === c.opponent_id));

  return (
    <div className="space-y-4">
      {detail && <AthleteDetail athlete={detail} onClose={() => setDetail(null)} />}

      <Card className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">{myName} <span className="text-ink-faint">vs</span> {theirName}</p>
          <p className="text-sm text-ink-muted">
            {c.kind === "beach" ? "🏖️ Praia" : "🏐 Quadra"} · {c.sex === "male" ? "Masc" : "Fem"}
            {c.bet_amount > 0 && <> · aposta {c.bet_amount} {c.bet_currency === "gold" ? "🥇" : "🪙"} (vencedor leva {c.bet_amount * 2})</>}
            {c.weather && <> · clima {c.weather}</>}
          </p>
        </div>
        {!finished && (
          <Button variant="ghost" size="sm" onClick={() => cancel.mutate(c.id)}>Sair</Button>
        )}
      </Card>

      {finished ? (
        <OnlineReplay
          challenge={c}
          iWon={iWon}
          myName={myName}
          theirName={theirName}
          onLeave={onLeave}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Meu time */}
          <Card>
            <p className="mb-2 flex items-center justify-between font-semibold">
              Seu time
              {myReady && <span className="text-xs text-emerald-400">✅ Pronto</span>}
            </p>
            {myReady ? (
              <TeamList athletes={myAth} onClick={setDetail} />
            ) : (
              <LineupPicker challengeId={c.id} kind={c.kind} sex={c.sex} teamSize={teamSize} current={myAth} />
            )}
          </Card>
          {/* Time adversário */}
          <Card>
            <p className="mb-2 flex items-center justify-between font-semibold">
              {theirName}
              <span className={cn("text-xs", theirReady ? "text-emerald-400" : "text-ink-faint")}>
                {theirReady ? "✅ Pronto" : "aguardando…"}
              </span>
            </p>
            {theirAth.length ? (
              <TeamList athletes={theirAth} onClick={setDetail} />
            ) : (
              <p className="text-sm text-ink-muted">O adversário ainda não escalou o time.</p>
            )}
          </Card>
        </div>
      )}
      {!finished && myReady && !theirReady && (
        <Card className="text-center text-sm text-ink-muted">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" /> Aguardando o adversário ficar pronto…
        </Card>
      )}
    </div>
  );
}

const REPLAY_SPEEDS = [2, 4, 6, 8, 12] as const;
const REPLAY_BASE_MS = 700;

function deriveScore(events: MatchEvent[]) {
  let home = 0, away = 0, setHome = 0, setAway = 0;
  for (const e of events) {
    if (e.event_type === "set_start") { home = 0; away = 0; }
    else if (e.event_type === "point") { if (e.side === "home") home++; else away++; }
    else if (e.event_type === "set_end") { if (home > away) setHome++; else setAway++; }
  }
  return { home, away, setHome, setAway };
}

/** Reprodução narrada do X1 (challenger = "home"). Esconde o resultado até o fim. */
function OnlineReplay({
  challenge: c, iWon, myName, theirName, onLeave,
}: {
  challenge: Challenge; iWon: boolean; myName: string; theirName: string; onLeave: () => void;
}) {
  const events = useMemo(() => (Array.isArray(c.events) ? c.events : []), [c.events]);
  const [revealed, setRevealed] = useState(0);
  const [speed, setSpeed] = useState<number>(2);
  const logRef = useRef<HTMLDivElement>(null);
  const hasEvents = events.length > 0;
  const done = !hasEvents || revealed >= events.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), REPLAY_BASE_MS / speed);
    return () => clearTimeout(t);
  }, [revealed, speed, done, events.length]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [revealed]);

  const shown = useMemo(() => events.slice(0, revealed), [events, revealed]);
  const score = useMemo(() => deriveScore(shown), [shown]);

  return (
    <div className="space-y-4">
      {/* Placar */}
      <Card>
        <div className="flex items-center justify-around text-center">
          <div className="w-28">
            <p className="truncate font-semibold">{c.challenger_name}</p>
            <p className="text-3xl font-black tabular-nums text-brand">{score.setHome}</p>
            <p className="text-[10px] uppercase text-ink-faint">sets</p>
          </div>
          <div>
            <div className="text-4xl font-black tabular-nums">
              {score.home} <span className="text-ink-faint">x</span> {score.away}
            </div>
            <div className="text-xs uppercase tracking-widest text-ink-faint">ponto do set</div>
          </div>
          <div className="w-28">
            <p className="truncate font-semibold">{c.opponent_name}</p>
            <p className="text-3xl font-black tabular-nums text-brand">{score.setAway}</p>
            <p className="text-[10px] uppercase text-ink-faint">sets</p>
          </div>
        </div>

        {done ? (
          <div className="mt-4 space-y-1 text-center">
            <Trophy className={cn("mx-auto h-9 w-9", iWon ? "text-amber-400" : "text-ink-faint")} />
            <p className="text-lg font-bold">{c.result_text}</p>
            <p className={cn("font-semibold", iWon ? "text-emerald-400" : "text-red-400")}>
              {iWon
                ? `🎉 Você venceu! ${c.bet_amount > 0 ? `+${c.bet_amount} ${c.bet_currency === "gold" ? "ouro" : "prata"}` : ""}`
                : "Você perdeu este desafio."}
            </p>
            <Button className="mt-3" onClick={onLeave}>Voltar ao lobby</Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs uppercase tracking-wide text-ink-faint">Velocidade</span>
            {REPLAY_SPEEDS.map((s) => (
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
            <Button variant="subtle" size="sm" onClick={() => setRevealed(events.length)}>
              <FastForward className="h-4 w-4" /> Resultado
            </Button>
          </div>
        )}
      </Card>

      {/* Narração */}
      <Card>
        <p className="mb-2 text-sm font-semibold">
          Narração — {myName} <span className="text-ink-faint">vs</span> {theirName}
          {c.weather ? ` · clima ${c.weather}` : ""}
        </p>
        <div ref={logRef} className="max-h-80 space-y-1 overflow-y-auto pr-1 scroll-smooth">
          {!hasEvents && <p className="text-ink-faint">Esta partida não tem narração registrada.</p>}
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

function TeamList({ athletes, onClick }: { athletes: Athlete[]; onClick: (a: Athlete) => void }) {
  return (
    <div className="space-y-1.5">
      {athletes.map((a) => (
        <button key={a.id} onClick={() => onClick(a)}
          className="flex w-full items-center justify-between rounded bg-graphite px-3 py-2 text-left text-sm hover:bg-graphite-light">
          <span>{a.first_name} {a.last_name}</span>
          <span className="text-xs text-ink-muted">CA {a.current_ability} · LVL {a.level} · ⓘ</span>
        </button>
      ))}
    </div>
  );
}

function LineupPicker({ challengeId, kind, sex, teamSize, current }: {
  challengeId: string; kind: string; sex: string; teamSize: number; current: Athlete[];
}) {
  const { club } = useMyClub();
  const { data: squad } = useClubAthletes(club?.id);
  const save = useSetLineup(challengeId);
  const ready = useReady(challengeId);
  const [picked, setPicked] = useState<string[]>(current.map((a) => a.id));

  const eligible = useMemo(
    () => (squad ?? []).filter((a: Athlete) => a.sex === sex && (kind === "beach" ? a.beach_position : a.court_position)),
    [squad, sex, kind],
  );
  const toggle = (idV: string) =>
    setPicked((p) => (p.includes(idV) ? p.filter((x) => x !== idV) : p.length < teamSize ? [...p, idV] : p));

  return (
    <div>
      {!eligible.length ? (
        <p className="text-sm text-amber-400">Sem atletas elegíveis. Contrate no Mercado.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {eligible.map((a) => {
              const on = picked.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggle(a.id)}
                  className={cn("flex w-full items-center justify-between rounded border px-3 py-1.5 text-left text-sm",
                    on ? "border-brand bg-brand/10" : "border-graphite-border bg-graphite")}>
                  <span>{a.first_name} {a.last_name}</span>
                  <span className="text-xs text-ink-muted">CA {a.current_ability}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="subtle" onClick={() => save.mutate(picked)}
              disabled={picked.length !== teamSize || save.isPending}>
              Salvar time ({picked.length}/{teamSize})
            </Button>
            <Button size="sm" onClick={() => ready.mutate()}
              disabled={ready.isPending || save.isPending || picked.length !== teamSize}
              title="Confirma o time e fica pronto">
              <Flag className="h-4 w-4" /> Pronto!
            </Button>
          </div>
          {(save.isError || ready.isError) && (
            <p className="mt-2 text-sm text-red-400">{errMsg(save.error || ready.error)}</p>
          )}
          <p className="mt-1 text-[11px] text-ink-faint">
            <Coins className="mr-1 inline h-3 w-3" /> Salve o time e clique em Pronto. Quando os dois estiverem prontos, a partida roda.
          </p>
        </>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, opts }: {
  label: string; value: string; onChange: (v: string) => void; opts: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const i = m.indexOf("{");
  if (i >= 0) try { return JSON.parse(m.slice(i)).detail ?? m; } catch { /* */ }
  return m;
}

function Spinner() {
  return <div className="flex justify-center py-16 text-ink-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}
