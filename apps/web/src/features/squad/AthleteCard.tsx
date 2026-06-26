import { type ReactNode } from "react";
import {
  ATTRIBUTE_LABEL,
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
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-semibold leading-tight">
            <SexBadge sex={athlete.sex} />
            {athlete.first_name} {athlete.last_name}
            {athlete.is_custom && (
              <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand">
                custom
              </span>
            )}
          </p>
          <p className="text-xs text-ink-muted">
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
