import { useState } from "react";
import { Loader2, Gift, Info, Sparkles, X, Lock } from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  LOOTBOX_RARITY_LABEL,
  LOOTBOX_RARITY_TONE,
  POSITION_LABEL,
  SEX_LABEL,
  type Athlete,
  type Lootbox,
  type LootboxInfoListing,
  type SpinResult,
} from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMe, useMyClub } from "@/lib/game";
import { useLootboxInfo, useLootboxes, useSpin } from "@/lib/lootbox";
import { AthleteDetail } from "@/features/squad/AthleteCard";

export function LootboxPage() {
  const { data: boxes, isLoading, isError } = useLootboxes();
  const { club } = useMyClub();
  const { data: me } = useMe();
  const spin = useSpin(club?.id);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gift className="h-6 w-6 text-brand" /> Lootbox
        </h1>
        <p className="text-sm text-ink-muted">
          Gire as caixas e tente a sorte! Você pode ganhar revelações, atletas de contratação
          e craques personalizados.
        </p>
      </header>

      {infoId && <InfoModal boxId={infoId} onClose={() => setInfoId(null)} />}
      {result && <ResultModal result={result} onClose={() => setResult(null)} />}

      {isError ? (
        <Card className="text-ink-muted">Não foi possível carregar as caixas.</Card>
      ) : isLoading ? (
        <Spinner />
      ) : !boxes?.length ? (
        <Card className="text-ink-muted">Nenhuma caixa disponível no momento.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((b) => {
            const bal = b.cost_currency === "gold" ? me?.gold ?? 0 : me?.silver ?? 0;
            const empty = b.available_count === 0;
            const canSpin = bal >= b.cost_amount && !empty;
            const spinning = spin.isPending && spin.variables === b.id;
            return (
              <BoxCard
                key={b.id}
                box={b}
                empty={empty}
                canSpin={canSpin}
                spinning={spinning}
                onInfo={() => setInfoId(b.id)}
                onSpin={() =>
                  spin.mutate(b.id, { onSuccess: (res) => setResult(res) })
                }
              />
            );
          })}
        </div>
      )}
      {spin.isError && (
        <p className="text-sm text-red-400">
          {String(spin.error).includes("402")
            ? "Saldo insuficiente para girar."
            : "Não foi possível girar (caixa esgotada?)."}
        </p>
      )}
    </div>
  );
}

function BoxCard({
  box: b, empty, canSpin, spinning, onInfo, onSpin,
}: {
  box: Lootbox; empty: boolean; canSpin: boolean; spinning: boolean;
  onInfo: () => void; onSpin: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-graphite text-2xl">
          {b.image_url ? <img src={b.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : "🎁"}
        </div>
        <button onClick={onInfo} className="text-ink-faint hover:text-brand" title="Ver atletas de contratação na caixa">
          <Info className="h-5 w-5" />
        </button>
      </div>
      <div>
        <p className="font-semibold leading-tight">{b.name}</p>
        <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", LOOTBOX_RARITY_TONE[b.rarity])}>
          {LOOTBOX_RARITY_LABEL[b.rarity]}
        </span>
        {b.description && <p className="mt-1 text-xs text-ink-faint">{b.description}</p>}
      </div>
      <p className="text-xs text-ink-muted">
        {b.item_count} prêmio(s){empty && <span className="text-amber-400"> · esgotada</span>}
      </p>
      <Button className="mt-auto" onClick={onSpin} disabled={spinning || !canSpin} title={canSpin ? "" : empty ? "Caixa esgotada" : "Saldo insuficiente"}>
        {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Girar por {b.cost_currency === "gold" ? "🥇" : "🥈"} {b.cost_amount.toLocaleString("pt-BR")}
      </Button>
    </Card>
  );
}

const ATTR_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof typeof ATTRIBUTE_LABEL)[];

function InfoModal({ boxId, onClose }: { boxId: string; onClose: () => void }) {
  const { data, isLoading } = useLootboxInfo(boxId);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-graphite-border bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">{data?.name ?? "Caixa"}</p>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Também pode sair: <b className="text-ink">{data.revelation_count}</b> revelação(ões) ·{" "}
              <b className="text-ink">{data.custom_count}</b> personalizado(s).
            </p>
            <p className="mb-2 text-sm font-semibold">Atletas de contratação nesta caixa</p>
            {!data.listings.length ? (
              <p className="text-sm text-ink-muted">Nenhum atleta de contratação nesta caixa.</p>
            ) : (
              <div className="space-y-2">
                {data.listings.map((l) => (
                  <ListingRow key={l.item_id} listing={l} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ListingRow({ listing: l }: { listing: LootboxInfoListing }) {
  const [open, setOpen] = useState(false);
  const pos = l.beach_position ?? l.court_position ?? "";
  return (
    <div className={cn("rounded-lg border p-3", l.claimed ? "border-graphite-border bg-graphite/30 opacity-60" : "border-graphite-border bg-graphite/40")}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 text-left">
          <p className={cn("truncate font-medium", l.claimed && "line-through")}>
            {l.name}
          </p>
          <p className="text-xs text-ink-muted">
            {POSITION_LABEL[pos] ?? pos} · {SEX_LABEL[l.sex as "male" | "female"]} · {l.age}a · HAB {l.current_ability} · POT {l.potential_ability}
          </p>
        </button>
        <div className="shrink-0 text-right">
          {l.claimed ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-400">
              <Lock className="h-3 w-3" /> já ganho
            </span>
          ) : (
            <span className="rounded bg-graphite px-1.5 py-0.5 text-[11px] text-ink-muted">{l.probability.toFixed(1)}%</span>
          )}
        </div>
      </div>
      {l.claimed && (
        <p className="mt-1 text-[11px] text-ink-faint">Alguém já ganhou e recebeu este atleta na sorte.</p>
      )}
      {open && (
        <div className="mt-2 grid grid-cols-4 gap-1 border-t border-graphite-border pt-2">
          {ATTR_KEYS.map((k) => (
            <div key={k} className="rounded bg-graphite px-1 py-0.5 text-center">
              <p className="text-xs font-bold tabular-nums">{(l.attributes as Record<string, number>)[k] ?? "—"}</p>
              <p className="text-[8px] uppercase leading-tight text-ink-faint">{ATTRIBUTE_LABEL[k].slice(0, 4)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultModal({ result, onClose }: { result: SpinResult; onClose: () => void }) {
  const [detail, setDetail] = useState(false);
  const a: Athlete = result.athlete;
  const kindLabel =
    result.won.kind === "listing" ? "Atleta de contratação" : result.won.kind === "custom" ? "Craque personalizado" : "Revelação";
  if (detail) return <AthleteDetail athlete={a} onClose={onClose} />;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-surface p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-amber-500/15">
          <Sparkles className="h-9 w-9 text-amber-400" />
        </div>
        <p className="text-sm uppercase tracking-wide text-ink-faint">{kindLabel}</p>
        <p className="mt-1 text-xl font-black text-amber-300">{a.first_name} {a.last_name}</p>
        <p className="mt-1 text-sm text-ink-muted">HAB {a.current_ability} · POT {a.potential_ability} — foi para o seu elenco! 🎉</p>
        <div className="mt-5 flex gap-2">
          <Button variant="subtle" className="flex-1" onClick={() => setDetail(true)}>Ver detalhes</Button>
          <Button className="flex-1" onClick={onClose}>Continuar</Button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
