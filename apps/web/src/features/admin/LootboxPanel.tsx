import { useState } from "react";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Lock } from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  BeachPosition,
  CourtPosition,
  LOOTBOX_RARITY_LABEL,
  Modality,
  POSITION_LABEL,
  Sex,
  SEX_LABEL,
  type AthleteAttributes,
  type LootboxItem,
  type LootboxRarity,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useAdminAddLootboxItem,
  useAdminCreateLootbox,
  useAdminDeleteLootbox,
  useAdminDeleteLootboxItem,
  useAdminListings,
  useAdminLootboxDetail,
  useAdminLootboxes,
  useAdminUpdateLootboxItem,
} from "@/lib/admin";

const RARITIES: LootboxRarity[] = ["comum", "raro", "super_raro", "lendario"];

export function LootboxPanel() {
  const [manage, setManage] = useState<string | null>(null);
  if (manage) return <Manage id={manage} onBack={() => setManage(null)} />;
  return <Overview onManage={setManage} />;
}

function Overview({ onManage }: { onManage: (id: string) => void }) {
  const { data: boxes, isLoading } = useAdminLootboxes();
  const del = useAdminDeleteLootbox();
  return (
    <div className="space-y-5">
      <CreateForm />
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Caixas ({boxes?.length ?? 0})</p>
        {isLoading ? (
          <Spinner />
        ) : !boxes?.length ? (
          <Card className="text-ink-muted">Nenhuma caixa criada ainda.</Card>
        ) : (
          <div className="space-y-2">
            {boxes.map((b) => (
              <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    🎁 {b.name}
                    <span className="rounded bg-graphite px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink-muted">
                      {LOOTBOX_RARITY_LABEL[b.rarity]}
                    </span>
                    {!b.active && <span className="text-[10px] text-ink-faint">(oculta)</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {b.item_count} item(ns) · giro {b.cost_currency === "gold" ? "🥇" : "🥈"} {b.cost_amount}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onManage(b.id)}>Gerir</Button>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(b.id)} disabled={del.isPending}>
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

function CreateForm() {
  const create = useAdminCreateLootbox();
  const [open, setOpen] = useState(true);
  const [f, setF] = useState({
    name: "", rarity: "comum" as LootboxRarity, description: "",
    cost_currency: "silver", cost_amount: 100,
  });
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  function submit() {
    create.mutate(
      { ...f, name: f.name.trim() || "Caixa", description: f.description.trim() || null },
      { onSuccess: () => set("name", "") },
    );
  }

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <p className="flex items-center gap-2 font-semibold"><Plus className="h-5 w-5 text-brand" /> Criar caixa (Lootbox)</p>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome da caixa"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="Caixa de Verão" /></Field>
            <Field label="Raridade">
              <select value={f.rarity} onChange={(e) => set("rarity", e.target.value)} className="input">
                {RARITIES.map((r) => <option key={r} value={r}>{LOOTBOX_RARITY_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="Moeda do giro">
              <select value={f.cost_currency} onChange={(e) => set("cost_currency", e.target.value)} className="input">
                <option value="silver">🥈 Prata</option>
                <option value="gold">🥇 Ouro</option>
              </select>
            </Field>
            <Field label="Custo por giro"><Num v={f.cost_amount} on={(n) => set("cost_amount", n)} /></Field>
          </div>
          <Field label="Descrição (opcional)"><input value={f.description} onChange={(e) => set("description", e.target.value)} className="input" /></Field>
          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar caixa
            </Button>
            {create.isSuccess && <span className="text-sm text-emerald-400">Caixa criada!</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Manage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useAdminLootboxDetail(id);
  if (isLoading || !data) return <Spinner />;
  const b = data.box;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar às caixas
      </button>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold">🎁 {b.name}
            <span className="rounded bg-graphite px-1.5 py-0.5 text-[9px] font-bold uppercase text-ink-muted">{LOOTBOX_RARITY_LABEL[b.rarity]}</span>
          </p>
          <p className="text-sm text-ink-muted">Giro: {b.cost_currency === "gold" ? "🥇" : "🥈"} {b.cost_amount} · {b.item_count} item(ns)</p>
        </div>
      </Card>

      <AddItemForm boxId={id} />

      <Card>
        <p className="mb-2 font-semibold">Itens da caixa ({data.items.length})</p>
        <p className="mb-3 text-xs text-ink-faint">
          A probabilidade é o peso do sorteio. Itens de contratação já ganhos ficam travados.
        </p>
        {!data.items.length ? (
          <p className="text-sm text-ink-muted">Nenhum item ainda. Adicione acima.</p>
        ) : (
          <div className="space-y-2">
            {data.items.map((it) => <ItemRow key={it.id} boxId={id} item={it} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function ItemRow({ boxId, item }: { boxId: string; item: LootboxItem }) {
  const upd = useAdminUpdateLootboxItem(boxId);
  const del = useAdminDeleteLootboxItem(boxId);
  const [prob, setProb] = useState(item.probability);
  const kindLabel = item.kind === "revelation" ? "Revelação" : item.kind === "custom" ? "Personalizado" : "Contratação";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-graphite/50 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">
        {item.claimed && <Lock className="mr-1 inline h-3 w-3 text-red-400" />}
        <span className={cn(item.claimed && "line-through opacity-60")}>{item.label}</span>
        <span className="ml-2 text-[10px] uppercase text-ink-faint">{kindLabel}</span>
      </span>
      <label className="flex items-center gap-1 text-xs text-ink-muted">
        prob
        <input type="number" min={0} max={100} step={0.1} value={prob}
          onChange={(e) => setProb(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-16 rounded border border-graphite-border bg-surface px-1 py-0.5 text-center" />
        %
      </label>
      <Button size="sm" variant="subtle" onClick={() => upd.mutate({ itemId: item.id, probability: prob })} disabled={upd.isPending}>
        <Save className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => del.mutate(item.id)} disabled={del.isPending}>
        <Trash2 className="h-4 w-4 text-red-400" />
      </Button>
    </div>
  );
}

type Disc = "beach" | "indoor" | "both";
const ATTR_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof AthleteAttributes)[];

function AddItemForm({ boxId }: { boxId: string }) {
  const add = useAdminAddLootboxItem(boxId);
  const { data: listings } = useAdminListings();
  const [kind, setKind] = useState<"revelation" | "listing" | "custom">("revelation");
  const [prob, setProb] = useState(10);

  // revelation
  const [revDisc, setRevDisc] = useState<"beach" | "indoor">("beach");
  // listing
  const [listingId, setListingId] = useState("");
  // custom
  const [c, setC] = useState({
    first_name: "", last_name: "", sex: Sex.MALE as Sex, disc: "beach" as Disc,
    beach: BeachPosition.UNIVERSAL as BeachPosition, court: CourtPosition.OUTSIDE as CourtPosition,
    age: 24, height_cm: 190, weight_kg: 85,
  });
  const [attrs, setAttrs] = useState<Record<string, number>>(
    () => ATTR_KEYS.reduce((a, k) => ({ ...a, [k]: 60 }), {} as Record<string, number>),
  );
  const setC2 = (k: string, v: unknown) => setC((s) => ({ ...s, [k]: v }));

  const availableListings = (listings ?? []).filter((l) => l.status === "published" || l.status === "expired");

  function modalityFor(sex: Sex, disc: Disc): Modality {
    const indoor = disc === "indoor";
    return sex === Sex.MALE
      ? indoor ? Modality.INDOOR_M : Modality.BEACH_M
      : indoor ? Modality.INDOOR_F : Modality.BEACH_F;
  }

  function submit() {
    if (kind === "revelation") {
      add.mutate({
        kind: "revelation",
        probability: prob,
        modality: revDisc === "indoor" ? Modality.INDOOR_M : Modality.BEACH_M,
      });
    } else if (kind === "listing") {
      if (!listingId) return;
      add.mutate({ kind: "listing", probability: prob, listing_id: listingId });
    } else {
      const showBeach = c.disc === "beach" || c.disc === "both";
      const showCourt = c.disc === "indoor" || c.disc === "both";
      add.mutate({
        kind: "custom",
        probability: prob,
        first_name: c.first_name.trim() || "Atleta",
        last_name: c.last_name.trim() || "Lootbox",
        sex: c.sex,
        modality: modalityFor(c.sex, c.disc),
        beach_position: showBeach ? c.beach : null,
        court_position: showCourt ? c.court : null,
        age: c.age, height_cm: c.height_cm, weight_kg: c.weight_kg,
        attributes: attrs,
      });
    }
  }

  return (
    <Card>
      <p className="mb-3 font-semibold">Adicionar item à caixa</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["revelation", "listing", "custom"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", kind === k ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink")}>
            {k === "revelation" ? "Revelação" : k === "listing" ? "Contratação" : "Personalizado"}
          </button>
        ))}
      </div>

      {kind === "revelation" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Disciplina (sexo é aleatório)">
            <select value={revDisc} onChange={(e) => setRevDisc(e.target.value as "beach" | "indoor")} className="input">
              <option value="beach">Praia</option>
              <option value="indoor">Quadra</option>
            </select>
          </Field>
        </div>
      )}

      {kind === "listing" && (
        <Field label="Atleta de contratação (não contratado ou expirado)">
          <select value={listingId} onChange={(e) => setListingId(e.target.value)} className="input">
            <option value="">— selecione —</option>
            {availableListings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.first_name} {l.last_name} · HAB {l.current_ability} · {l.status === "expired" ? "expirado" : "disponível"}
              </option>
            ))}
          </select>
          {!availableListings.length && (
            <span className="text-xs text-amber-400">Crie anúncios na aba Anúncios primeiro.</span>
          )}
        </Field>
      )}

      {kind === "custom" && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome"><input value={c.first_name} onChange={(e) => setC2("first_name", e.target.value)} className="input" /></Field>
            <Field label="Sobrenome"><input value={c.last_name} onChange={(e) => setC2("last_name", e.target.value)} className="input" /></Field>
            <Field label="Sexo">
              <select value={c.sex} onChange={(e) => setC2("sex", e.target.value as Sex)} className="input">
                <option value={Sex.MALE}>{SEX_LABEL.male}</option>
                <option value={Sex.FEMALE}>{SEX_LABEL.female}</option>
              </select>
            </Field>
            <Field label="Disciplina">
              <select value={c.disc} onChange={(e) => setC2("disc", e.target.value as Disc)} className="input">
                <option value="beach">Praia</option>
                <option value="indoor">Quadra</option>
                <option value="both">Ambos</option>
              </select>
            </Field>
            {(c.disc === "beach" || c.disc === "both") && (
              <Field label="Posição praia">
                <select value={c.beach} onChange={(e) => setC2("beach", e.target.value as BeachPosition)} className="input">
                  {Object.values(BeachPosition).map((p) => <option key={p} value={p}>{POSITION_LABEL[p] ?? p}</option>)}
                </select>
              </Field>
            )}
            {(c.disc === "indoor" || c.disc === "both") && (
              <Field label="Posição quadra">
                <select value={c.court} onChange={(e) => setC2("court", e.target.value as CourtPosition)} className="input">
                  {Object.values(CourtPosition).map((p) => <option key={p} value={p}>{POSITION_LABEL[p] ?? p}</option>)}
                </select>
              </Field>
            )}
            <Field label="Idade"><Num v={c.age} on={(n) => setC2("age", n)} /></Field>
            <Field label="Altura (cm)"><Num v={c.height_cm} on={(n) => setC2("height_cm", n)} /></Field>
            <Field label="Peso (kg)"><Num v={c.weight_kg} on={(n) => setC2("weight_kg", n)} /></Field>
          </div>
          <div>
            <p className="mb-1 text-sm text-ink-muted">Atributos (1–99)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ATTR_KEYS.map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded bg-graphite px-2 py-1 text-xs">
                  <span className="truncate text-ink-muted">{ATTRIBUTE_LABEL[k]}</span>
                  <input type="number" min={1} max={99} value={attrs[k]}
                    onChange={(e) => setAttrs((s) => ({ ...s, [k]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) }))}
                    className="w-14 rounded border border-graphite-border bg-surface px-1 py-0.5 text-center text-ink" />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Probabilidade (%)"><Num v={prob} on={setProb} /></Field>
        <Button onClick={submit} disabled={add.isPending || (kind === "listing" && !listingId)}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar à caixa
        </Button>
        {add.isSuccess && <span className="text-sm text-emerald-400">Item adicionado!</span>}
        {add.isError && <span className="text-sm text-red-400">Erro ao adicionar.</span>}
      </div>
    </Card>
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

function Num({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <input type="number" min={0} value={v} onChange={(e) => on(Math.max(0, Number(e.target.value) || 0))} className="input" />
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
