import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, Dumbbell, ShoppingBag, Check, Lock, PartyPopper, Package,
} from "lucide-react";
import type { CtKind, InventoryItem, Requirement, TrainingCenter } from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBuildCenter, useCenters, useInventory } from "@/lib/store";

export function CtPage() {
  const { data: centers, isLoading, isError } = useCenters();
  const { data: inventory } = useInventory();
  const [tab, setTab] = useState<CtKind>("beach");
  const [party, setParty] = useState<string | null>(null);

  const active = centers?.find((c) => c.kind === tab) ?? null;

  return (
    <div className="space-y-6">
      {party && <CongratsModal message={party} onClose={() => setParty(null)} />}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Dumbbell className="h-6 w-6 text-brand" /> Centro de Treinamento
          </h1>
          <p className="text-sm text-ink-muted">
            Equipe os itens do baú para montar seu CT de Praia ou de Quadra.
          </p>
        </div>
        <Link to="/loja">
          <Button variant="subtle">
            <ShoppingBag className="h-4 w-4" /> Comprar itens na Loja
          </Button>
        </Link>
      </header>

      <ChestCard inventory={inventory ?? []} />

      {/* Categorias */}
      <div className="flex gap-2">
        {(["beach", "indoor"] as const).map((k) => {
          const c = centers?.find((x) => x.kind === k);
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                tab === k ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink",
              )}
            >
              {k === "beach" ? "🏖️ CT de Praia" : "🏐 CT de Quadra"}
              {c?.built && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>

      {isError ? (
        <Card className="text-ink-muted">Não foi possível carregar o CT.</Card>
      ) : isLoading || !active ? (
        <Spinner />
      ) : (
        <CenterCard center={active} onBuilt={setParty} />
      )}
    </div>
  );
}

function ChestCard({ inventory }: { inventory: InventoryItem[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-5 w-5 text-brand" />
        <h2 className="font-semibold">Baú de itens</h2>
        <span className="ml-auto text-xs text-ink-faint">
          {inventory.reduce((s, i) => s + i.quantity, 0)} itens
        </span>
      </div>
      {inventory.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Seu baú está vazio. Compre itens na <Link to="/loja" className="text-brand hover:underline">Loja</Link>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inventory.map((i) => (
            <span
              key={i.item_type}
              className="inline-flex items-center gap-1.5 rounded-lg bg-graphite px-2.5 py-1.5 text-sm"
              title={i.label}
            >
              <span className="text-lg">{i.emoji}</span>
              <span className="text-ink-muted">{i.label}</span>
              <span className="font-bold tabular-nums text-ink">×{i.quantity}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function CenterCard({
  center,
  onBuilt,
}: {
  center: TrainingCenter;
  onBuilt: (message: string) => void;
}) {
  const build = useBuildCenter();

  function montar() {
    build.mutate(center.kind, { onSuccess: (res) => onBuilt(res.message) });
  }

  if (center.built) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <PartyPopper className="h-8 w-8 text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-emerald-300">
              {center.label} conquistado! 🎉
            </p>
            <p className="text-sm text-ink-muted">
              Seu centro de treinamento está montado. Em breve, novas funções de
              treino chegam aqui.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const done = center.requirements.filter((r) => r.ok).length;
  const total = center.requirements.length;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{center.label}</h2>
          <p className="text-sm text-ink-muted">
            Requisitos atendidos: {done}/{total}
          </p>
        </div>
        <Button onClick={montar} disabled={!center.can_build || build.isPending}>
          {build.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : center.can_build ? (
            <Dumbbell className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {center.can_build ? "Montar CT" : "Faltam itens"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {center.requirements.map((r) => (
          <RequirementRow key={r.item_type} req={r} />
        ))}
      </div>

      {build.isError && (
        <p className="text-sm text-red-400">
          {String(build.error).replace(/^Error:\s*API \d+:\s*/, "")}
        </p>
      )}

      {!center.can_build && (
        <p className="text-xs text-ink-faint">
          Compre os itens que faltam na{" "}
          <Link to="/loja" className="text-brand hover:underline">Loja</Link> — eles
          chegam ao baú automaticamente.
        </p>
      )}
    </Card>
  );
}

function RequirementRow({ req: r }: { req: Requirement }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2",
        r.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-graphite-border bg-graphite/40",
      )}
    >
      <span className="text-xl">{r.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{r.label}</p>
        <p className={cn("text-xs", r.ok ? "text-emerald-400" : "text-ink-muted")}>
          {r.owned}/{r.required}
        </p>
      </div>
      {r.ok ? (
        <Check className="h-5 w-5 text-emerald-400" />
      ) : (
        <span className="rounded bg-graphite px-1.5 py-0.5 text-xs font-bold text-amber-400">
          faltam {r.required - r.owned}
        </span>
      )}
    </div>
  );
}

function CongratsModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-surface p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15">
          <PartyPopper className="h-9 w-9 text-emerald-400" />
        </div>
        <p className="text-lg font-bold text-emerald-300">{message}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Seu Centro de Treinamento está pronto. 🎉
        </p>
        <Button className="mt-5 w-full" onClick={onClose}>
          Continuar
        </Button>
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
