import { type ReactNode, useState } from "react";
import { X } from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  CONDITION_LABEL,
  POSITION_LABEL,
  Sex,
  type Athlete,
  type AthleteAttributes,
} from "@volley/shared";
import { cn } from "@/lib/utils";

export function SexBadge({ sex }: { sex: Athlete["sex"] }) {
  const female = sex === Sex.FEMALE;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold",
        female ? "bg-pink-500/20 text-pink-400" : "bg-sky-500/20 text-sky-400",
      )}
      title={female ? "Feminino" : "Masculino"}
    >
      {female ? "♀" : "♂"}
    </span>
  );
}

/** Indicador de disciplina: praia, quadra ou ambos. */
export function ModalityBadge({ athlete }: { athlete: Athlete }) {
  const both = !!athlete.beach_position && !!athlete.court_position;
  const beach = !!athlete.beach_position;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        both
          ? "bg-emerald-500/20 text-emerald-300"
          : beach
            ? "bg-amber-500/20 text-amber-400"
            : "bg-indigo-500/20 text-indigo-300",
      )}
      title={both ? "Joga praia e quadra" : beach ? "Vôlei de praia" : "Vôlei de quadra"}
    >
      {both ? "🏖️🏐 Ambos" : beach ? "🏖️ Praia" : "🏐 Quadra"}
    </span>
  );
}

/** Selo de condição física (Fadigado / Lesionado). Nada quando "ok". */
export function ConditionBadge({ athlete }: { athlete: Athlete }) {
  if (athlete.condition === "ok") return null;
  const injured = athlete.condition === "injured";
  const label = CONDITION_LABEL[athlete.condition];
  const extra = injured
    ? injuryDaysLeft(athlete.injured_until)
    : `${athlete.rest_games_left} jogo(s)`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
        injured ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-300",
      )}
      title={injured ? "Lesionado — fora por dias reais" : "Fadigado — precisa descansar"}
    >
      {injured ? "🚑" : "💤"} {label}
      {extra && <span className="font-normal opacity-80">· {extra}</span>}
    </span>
  );
}

function injuryDaysLeft(until: string | null): string {
  if (!until) return "";
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "";
  const days = Math.ceil(ms / (24 * 3600 * 1000));
  return `${days}d`;
}

function expiresLabel(at: string | null): string {
  if (!at) return "";
  const ms = new Date(at).getTime() - Date.now();
  if (ms <= 0) return "expirando…";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

/** Atleta de contratação (anúncio): tempo restante no elenco antes de expirar. */
export function ExpiresBadge({ athlete }: { athlete: Athlete }) {
  if (!athlete.expires_at) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300"
      title="Contratação por anúncio: ao expirar, sai do seu elenco"
    >
      ⏳ {expiresLabel(athlete.expires_at)}
    </span>
  );
}

const ALL_ATTRS = Object.keys(ATTRIBUTE_LABEL) as (keyof AthleteAttributes)[];

/** Modal com estatísticas detalhadas do atleta (incl. V/D offline e online). */
export function AthleteDetail({ athlete, onClose }: { athlete: Athlete; onClose: () => void }) {
  const a = athlete.attributes;
  const pos = athlete.beach_position ?? athlete.court_position ?? "";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-graphite-border bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-lg font-bold leading-tight">
              <SexBadge sex={athlete.sex} /> {athlete.first_name} {athlete.last_name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <ModalityBadge athlete={athlete} />
              <span className="rounded bg-graphite px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">LVL {athlete.level}</span>
              <ConditionBadge athlete={athlete} />
              <ExpiresBadge athlete={athlete} />
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {POSITION_LABEL[pos] ?? pos} · {age(athlete.birth_date)} anos · {athlete.height_cm}cm · {athlete.weight_kg}kg
            </p>
          </div>
          <div className="text-right">
            <p className={cn("text-3xl font-black tabular-nums", rating(athlete.current_ability))}>{athlete.current_ability}</p>
            <p className="text-[10px] uppercase text-ink-faint">pot {athlete.potential_ability}</p>
            <button onClick={onClose} className="mt-1 text-ink-faint hover:text-ink"><X className="ml-auto h-5 w-5" /></button>
          </div>
        </div>

        {a && (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {ALL_ATTRS.map((k) => (
              <div key={k} className="rounded bg-graphite px-2 py-1.5 text-center">
                <p className={cn("text-base font-bold tabular-nums", rating(a[k]))}>{a[k]}</p>
                <p className="text-[9px] uppercase leading-tight text-ink-faint">{ATTRIBUTE_LABEL[k]}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Single (offline)" value={`${athlete.wins}V · ${athlete.losses}D`} tone="text-sky-300" />
          <Stat label="Online (X1)" value={`${athlete.online_wins}V · ${athlete.online_losses}D`} tone="text-amber-300" />
          <Stat label="Valor de venda" value={`🪙 ${athlete.sale_value.toLocaleString("pt-BR")}`} tone="text-ink" />
          <Stat label="Total de partidas" value={`${athlete.wins + athlete.losses + athlete.online_wins + athlete.online_losses}`} tone="text-ink" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-graphite/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={cn("font-bold", tone)}>{value}</p>
    </div>
  );
}

function rating(v: number) {
  if (v >= 80) return "text-emerald-400";
  if (v >= 65) return "text-brand";
  if (v >= 50) return "text-ink";
  return "text-ink-muted";
}

function age(birth: string) {
  const d = new Date(birth);
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Atributos em destaque por modalidade.
const KEY_ATTRS: (keyof AthleteAttributes)[] = [
  "serve",
  "attack",
  "block",
  "defense",
  "reception",
];

export function AthleteCard({
  athlete,
  footer,
}: {
  athlete: Athlete;
  footer?: ReactNode;
}) {
  const pos = athlete.beach_position ?? athlete.court_position ?? "";
  const a = athlete.attributes;
  const [detail, setDetail] = useState(false);
  return (
    <div className="card p-4">
      {detail && <AthleteDetail athlete={athlete} onClose={() => setDetail(false)} />}
      <div className="flex items-start justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 font-semibold leading-tight">
            <SexBadge sex={athlete.sex} />
            <button onClick={() => setDetail(true)} className="hover:text-brand hover:underline" title="Ver estatísticas detalhadas">
              {athlete.first_name} {athlete.last_name}
            </button>
            {athlete.is_custom && (
              <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">
                custom
              </span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ModalityBadge athlete={athlete} />
            <span className="rounded bg-graphite px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
              LVL {athlete.level}
            </span>
            <ConditionBadge athlete={athlete} />
            <ExpiresBadge athlete={athlete} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {POSITION_LABEL[pos] ?? pos} · {age(athlete.birth_date)} anos · {athlete.height_cm}cm
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-black tabular-nums", rating(athlete.current_ability))}>
            {athlete.current_ability}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-ink-faint">
            pot {athlete.potential_ability}
          </p>
        </div>
      </div>

      {a && (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {KEY_ATTRS.map((k) => (
            <div key={k} className="rounded bg-graphite px-1.5 py-1 text-center">
              <p className={cn("text-sm font-bold tabular-nums", rating(a[k]))}>{a[k]}</p>
              <p className="text-[9px] uppercase text-ink-faint">{ATTRIBUTE_LABEL[k].slice(0, 4)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span className="text-emerald-400">🏆 {athlete.wins}V</span>
        <span className="text-red-400">💀 {athlete.losses}D</span>
        <span>💰 {athlete.sale_value.toLocaleString("pt-BR")}</span>
        {athlete.is_injured && <span className="text-red-400">🚑 lesionado</span>}
      </div>

      {footer && <div className="mt-3 border-t border-graphite-border pt-3">{footer}</div>}
    </div>
  );
}
