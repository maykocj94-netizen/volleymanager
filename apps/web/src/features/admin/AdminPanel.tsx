import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Coins, LogOut, Loader2, Pencil, Plus, Save, Trash2, Shield,
  Check, X, Tag, UserPlus, RotateCw, Hourglass,
} from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  BeachPosition,
  CourtPosition,
  Modality,
  POSITION_LABEL,
  Sex,
  SEX_LABEL,
  type AdminUser,
  type Athlete,
  type AthleteAttributes,
  type HireListing,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  clearAdminToken,
  useAdminAddAthlete,
  useAdminApproveUser,
  useAdminAthletes,
  useAdminCoins,
  useAdminCreateListing,
  useAdminDeleteListing,
  useAdminListings,
  useAdminPatchAthlete,
  useAdminRemoveAthlete,
  useAdminRepublishListing,
  useAdminResolveSale,
  useAdminSales,
  useAdminUpdateListing,
  useAdminUsers,
} from "@/lib/admin";

type Tab = "contas" | "vendas" | "anuncios";

export function AdminPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("contas");
  const { data: sales } = useAdminSales();
  const { data: users } = useAdminUsers();
  const pendingUsers = (users ?? []).filter((u) => !u.approved).length;

  function logout() {
    clearAdminToken();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-brand" />
          <div>
            <h1 className="text-2xl font-bold">Central de Contas</h1>
            <p className="text-sm text-ink-muted">Painel do dono — contas, vendas e contratações.</p>
          </div>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sair do admin
        </Button>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <TabBtn active={tab === "contas"} onClick={() => setTab("contas")} badge={pendingUsers}>
          <Shield className="h-4 w-4" /> Contas
        </TabBtn>
        <TabBtn active={tab === "vendas"} onClick={() => setTab("vendas")} badge={sales?.length ?? 0}>
          <Tag className="h-4 w-4" /> Vendas
        </TabBtn>
        <TabBtn active={tab === "anuncios"} onClick={() => setTab("anuncios")}>
          <UserPlus className="h-4 w-4" /> Anúncios
        </TabBtn>
      </div>

      {tab === "contas" && <AccountsPanel />}
      {tab === "vendas" && <SalesPanel />}
      {tab === "anuncios" && <ListingsPanel />}
    </div>
  );
}

// ====================== CONTAS ======================
function AccountsPanel() {
  const { data: users, isLoading, isError } = useAdminUsers();
  const [selId, setSelId] = useState<string | null>(null);
  const selected = users?.find((u) => u.user_id === selId) ?? users?.[0] ?? null;

  if (isError) {
    return (
      <Card className="text-red-400">
        Não foi possível carregar (token inválido ou API offline). Faça login como dono novamente.
      </Card>
    );
  }
  if (isLoading) return <Spinner />;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Usuários ({users?.length ?? 0})</p>
        {users?.map((u) => (
          <UserRow
            key={u.user_id}
            user={u}
            active={selected?.user_id === u.user_id}
            onClick={() => setSelId(u.user_id)}
          />
        ))}
        {users?.length === 0 && <p className="text-sm text-ink-muted">Nenhum usuário ainda.</p>}
      </div>
      {selected ? <UserDetail user={selected} /> : <Card className="text-ink-muted">Selecione um usuário.</Card>}
    </div>
  );
}

function UserRow({ user, active, onClick }: { user: AdminUser; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        active ? "border-brand bg-graphite-light" : "border-graphite-border bg-surface hover:bg-graphite-light",
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        {user.club_name ?? "(sem clube)"}
        {!user.approved && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
            pendente
          </span>
        )}
      </p>
      <p className="truncate text-xs text-ink-faint">{user.user_id}</p>
      <div className="mt-1 flex gap-3 text-xs text-ink-muted">
        <span>🥈 {user.silver}</span>
        <span>🥇 {user.gold}</span>
        <span>👥 {user.athlete_count}</span>
        <span>🏐 {user.matches_won}V/{user.matches_lost}D</span>
      </div>
    </button>
  );
}

function UserDetail({ user }: { user: AdminUser }) {
  const { data: athletes, isLoading } = useAdminAthletes(user.user_id);
  const coins = useAdminCoins();
  const approve = useAdminApproveUser();
  const addAthlete = useAdminAddAthlete(user.user_id);
  const [mod, setMod] = useState<Modality>(Modality.BEACH_M);
  const [silverDelta, setSilverDelta] = useState(1000);
  const [goldDelta, setGoldDelta] = useState(10);

  return (
    <div className="space-y-4">
      {/* Aprovação de entrada */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Aprovação de entrada</p>
          <p className="text-sm text-ink-muted">
            {user.approved ? "Conta liberada para jogar." : "Conta aguardando liberação do dono."}
          </p>
        </div>
        <Button
          variant={user.approved ? "outline" : "default"}
          onClick={() => approve.mutate({ userId: user.user_id, approved: !user.approved })}
          disabled={approve.isPending}
        >
          {user.approved ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {user.approved ? "Revogar acesso" : "Aprovar entrada"}
        </Button>
      </Card>

      {/* Moedas */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Coins className="h-5 w-5 text-brand" />
          <h2 className="font-semibold">Moedas — {user.club_name}</h2>
          <span className="ml-auto text-sm text-ink-muted">🥈 {user.silver} · 🥇 {user.gold}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CoinControl
            label="Prata" value={silverDelta} onChange={setSilverDelta}
            onAdd={() => coins.mutate({ userId: user.user_id, silver_delta: silverDelta, gold_delta: 0 })}
            onSub={() => coins.mutate({ userId: user.user_id, silver_delta: -silverDelta, gold_delta: 0 })}
            busy={coins.isPending}
          />
          <CoinControl
            label="Ouro" value={goldDelta} onChange={setGoldDelta}
            onAdd={() => coins.mutate({ userId: user.user_id, silver_delta: 0, gold_delta: goldDelta })}
            onSub={() => coins.mutate({ userId: user.user_id, silver_delta: 0, gold_delta: -goldDelta })}
            busy={coins.isPending}
          />
        </div>
      </Card>

      {/* Elenco */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Elenco ({athletes?.length ?? 0})</h2>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={mod}
              onChange={(e) => setMod(e.target.value as Modality)}
              className="h-9 rounded-lg border border-graphite-border bg-graphite px-2 text-sm"
            >
              <option value={Modality.BEACH_M}>Praia M</option>
              <option value={Modality.BEACH_F}>Praia F</option>
              <option value={Modality.INDOOR_M}>Quadra M</option>
              <option value={Modality.INDOOR_F}>Quadra F</option>
            </select>
            <Button size="sm" onClick={() => addAthlete.mutate(mod)} disabled={addAthlete.isPending}>
              {addAthlete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar atleta
            </Button>
          </div>
        </div>
        {isLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-2">
            {athletes?.map((a) => (
              <AthleteAdminRow key={a.id} athlete={a} userId={user.user_id} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ====================== VENDAS ======================
function SalesPanel() {
  const { data: sales, isLoading } = useAdminSales();
  const resolve = useAdminResolveSale();

  if (isLoading) return <Spinner />;
  if (!sales?.length) return <Card className="text-ink-muted">Nenhuma venda pendente.</Card>;

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-ink-faint">Vendas pendentes ({sales.length})</p>
      {sales.map((s) => (
        <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{s.athlete_name} <span className="text-xs text-ink-faint">· CA {s.current_ability}</span></p>
            <p className="text-xs text-ink-muted">Preço pedido: 🥈 {s.price.toLocaleString("pt-BR")} · vendedor {s.seller_id.slice(0, 8)}…</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => resolve.mutate({ id: s.id, approve: true })} disabled={resolve.isPending}>
              <Check className="h-4 w-4" /> Confirmar venda
            </Button>
            <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: s.id, approve: false })} disabled={resolve.isPending}>
              <X className="h-4 w-4" /> Recusar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ====================== ANÚNCIOS (criação personalizada) ======================
function ListingsPanel() {
  const { data: listings, isLoading } = useAdminListings();
  const republish = useAdminRepublishListing();
  const del = useAdminDeleteListing();
  const [editing, setEditing] = useState<HireListing | null>(null);

  return (
    <div className="space-y-5">
      <ListingForm key={editing?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">
          Anúncios ({listings?.length ?? 0})
        </p>
        {isLoading ? (
          <Spinner />
        ) : !listings?.length ? (
          <Card className="text-ink-muted">Nenhum anúncio criado ainda.</Card>
        ) : (
          <div className="space-y-2">
            {listings.map((li) => {
              const both = !!li.beach_position && !!li.court_position;
              const disc = both ? "🏖️🏐 Ambos" : li.beach_position ? "🏖️ Praia" : "🏐 Quadra";
              return (
                <Card key={li.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      {li.first_name} {li.last_name}
                      <StatusBadge status={li.status} />
                    </p>
                    <p className="text-xs text-ink-muted">
                      {disc} · {SEX_LABEL[li.sex]} · {li.age}a · CA {li.current_ability} · 🥈 {li.price.toLocaleString("pt-BR")}
                      {li.price_gold > 0 && ` · 🥇 ${li.price_gold.toLocaleString("pt-BR")}`} · validade {li.availability_days}d
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        setEditing(li);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    {li.status !== "published" && (
                      <Button size="sm" onClick={() => republish.mutate(li.id)} disabled={republish.isPending}>
                        <RotateCw className="h-4 w-4" /> Republicar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(li.id)} disabled={del.isPending}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: HireListing["status"] }) {
  const map: Record<string, { label: string; cls: string; icon?: boolean }> = {
    published: { label: "publicado", cls: "bg-emerald-500/20 text-emerald-400" },
    hired: { label: "contratado", cls: "bg-sky-500/20 text-sky-300" },
    expired: { label: "contrato expirado", cls: "bg-amber-500/20 text-amber-400", icon: true },
  };
  const m = map[status] ?? map.published;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${m.cls}`}>
      {m.icon && <Hourglass className="h-3 w-3" />}
      {m.label}
    </span>
  );
}

const ATTR_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof AthleteAttributes)[];

type Discipline = "beach" | "indoor" | "both";

function ListingForm({ editing, onDone }: { editing: HireListing | null; onDone: () => void }) {
  const create = useAdminCreateListing();
  const update = useAdminUpdateListing();
  const [open, setOpen] = useState(true);
  const initDisc: Discipline = editing
    ? editing.beach_position && editing.court_position
      ? "both"
      : editing.court_position
        ? "indoor"
        : "beach"
    : "beach";
  const [firstName, setFirstName] = useState(editing?.first_name ?? "");
  const [lastName, setLastName] = useState(editing?.last_name ?? "");
  const [sex, setSex] = useState<Sex>((editing?.sex as Sex) ?? Sex.MALE);
  const [discipline, setDiscipline] = useState<Discipline>(initDisc);
  const [beachPos, setBeachPos] = useState<BeachPosition>(
    (editing?.beach_position as BeachPosition) ?? BeachPosition.UNIVERSAL,
  );
  const [courtPos, setCourtPos] = useState<CourtPosition>(
    (editing?.court_position as CourtPosition) ?? CourtPosition.OUTSIDE,
  );
  const [age, setAge] = useState(editing?.age ?? 24);
  const [heightCm, setHeightCm] = useState(editing?.height_cm ?? 190);
  const [weightKg, setWeightKg] = useState(editing?.weight_kg ?? 85);
  const [price, setPrice] = useState(editing?.price ?? 1000);
  const [priceGold, setPriceGold] = useState(editing?.price_gold ?? 0);
  const [days, setDays] = useState(editing?.availability_days ?? 30);
  const [attrs, setAttrs] = useState<Record<string, number>>(() => {
    const base = ATTR_KEYS.reduce((acc, k) => ({ ...acc, [k]: 65 }), {} as Record<string, number>);
    if (editing?.attributes) {
      for (const k of ATTR_KEYS) if (editing.attributes[k] != null) base[k] = editing.attributes[k];
    }
    return base;
  });

  const busy = create.isPending || update.isPending;
  const showBeach = discipline === "beach" || discipline === "both";
  const showCourt = discipline === "indoor" || discipline === "both";

  function submit() {
    const modality =
      sex === Sex.MALE
        ? discipline === "indoor" ? Modality.INDOOR_M : Modality.BEACH_M
        : discipline === "indoor" ? Modality.INDOOR_F : Modality.BEACH_F;
    const beach_position = showBeach ? beachPos : null;
    const court_position = showCourt ? courtPos : null;
    const body = {
      first_name: firstName.trim() || "Atleta",
      last_name: lastName.trim() || "Publicado",
      country: "BRA",
      sex,
      modality,
      beach_position,
      court_position,
      age,
      height_cm: heightCm,
      weight_kg: weightKg,
      attributes: attrs,
      price,
      price_gold: priceGold,
      availability_days: days,
    };
    if (editing) {
      update.mutate(
        { id: editing.id, body: { ...body, clear_beach: !beach_position, clear_court: !court_position } },
        { onSuccess: onDone },
      );
    } else {
      create.mutate(body, { onSuccess: () => { setFirstName(""); setLastName(""); } });
    }
  }

  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <p className="flex items-center gap-2 font-semibold">
            {editing ? <Pencil className="h-5 w-5 text-brand" /> : <Plus className="h-5 w-5 text-brand" />}
            {editing ? `Editar anúncio — ${editing.first_name} ${editing.last_name}` : "Criar atleta para contratação"}
          </p>
          <p className="text-sm text-ink-muted">Defina atributos, idade, físico, preço (prata/ouro) e validade.</p>
        </div>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome"><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Nome" /></Field>
            <Field label="Sobrenome"><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Sobrenome" /></Field>
            <Field label="Sexo">
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className="input">
                <option value={Sex.MALE}>{SEX_LABEL.male}</option>
                <option value={Sex.FEMALE}>{SEX_LABEL.female}</option>
              </select>
            </Field>
            <Field label="Disciplina">
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)} className="input">
                <option value="beach">Praia</option>
                <option value="indoor">Quadra</option>
                <option value="both">Ambos (praia e quadra)</option>
              </select>
            </Field>
            {showBeach && (
              <Field label="Posição (praia)">
                <select value={beachPos} onChange={(e) => setBeachPos(e.target.value as BeachPosition)} className="input">
                  {Object.values(BeachPosition).map((p) => <option key={p} value={p}>{POSITION_LABEL[p] ?? p}</option>)}
                </select>
              </Field>
            )}
            {showCourt && (
              <Field label="Posição (quadra)">
                <select value={courtPos} onChange={(e) => setCourtPos(e.target.value as CourtPosition)} className="input">
                  {Object.values(CourtPosition).map((p) => <option key={p} value={p}>{POSITION_LABEL[p] ?? p}</option>)}
                </select>
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Idade"><input type="number" min={15} max={50} value={age} onChange={(e) => setAge(Math.max(15, Math.min(50, Number(e.target.value) || 24)))} className="input" /></Field>
            <Field label="Altura (cm)"><input type="number" min={140} max={230} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value) || 190)} className="input" /></Field>
            <Field label="Peso (kg)"><input type="number" min={40} max={160} value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value) || 85)} className="input" /></Field>
            <Field label="Preço (prata)"><input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} className="input" /></Field>
            <Field label="Preço (ouro) — 0 = não vende por ouro"><input type="number" min={0} value={priceGold} onChange={(e) => setPriceGold(Math.max(0, Number(e.target.value)))} className="input" /></Field>
            <Field label="Validade após contratar (dias reais)"><input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} className="input" /></Field>
          </div>

          <div>
            <p className="mb-2 text-sm text-ink-muted">Atributos (1–99)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ATTR_KEYS.map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded bg-graphite px-2 py-1 text-xs">
                  <span className="text-ink-muted">{ATTRIBUTE_LABEL[k]}</span>
                  <input
                    type="number" min={1} max={99} value={attrs[k]}
                    onChange={(e) => setAttrs((s) => ({ ...s, [k]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) }))}
                    className="w-14 rounded border border-graphite-border bg-surface px-1 py-0.5 text-center text-ink"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Salvar alterações" : "Publicar anúncio"}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={onDone}>
                <X className="h-4 w-4" /> Cancelar edição
              </Button>
            )}
            {!editing && create.isSuccess && <span className="text-sm text-emerald-400">Anúncio publicado!</span>}
            {editing && update.isSuccess && <span className="text-sm text-emerald-400">Salvo!</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

// ====================== compartilhados ======================
function CoinControl({
  label, value, onChange, onAdd, onSub, busy,
}: {
  label: string; value: number; onChange: (v: number) => void;
  onAdd: () => void; onSub: () => void; busy: boolean;
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="text-ink-muted">{label} (quantidade)</span>
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 rounded-lg border border-graphite-border bg-graphite px-2 text-ink" />
      </label>
      <Button size="sm" variant="subtle" onClick={onAdd} disabled={busy}>+ Adicionar</Button>
      <Button size="sm" variant="outline" onClick={onSub} disabled={busy}>− Remover</Button>
    </div>
  );
}

function AthleteAdminRow({ athlete, userId }: { athlete: Athlete; userId: string }) {
  const patch = useAdminPatchAthlete(userId);
  const remove = useAdminRemoveAthlete(userId);
  const [open, setOpen] = useState(false);
  const [ca, setCa] = useState(athlete.current_ability);
  const [pa, setPa] = useState(athlete.potential_ability);
  const [attrs, setAttrs] = useState<AthleteAttributes>(athlete.attributes ?? ({} as AthleteAttributes));
  const pos = athlete.beach_position ?? athlete.court_position ?? "";

  function save() {
    patch.mutate({ athleteId: athlete.id, body: { current_ability: ca, potential_ability: pa, attributes: attrs } });
    setOpen(false);
  }

  return (
    <div className="rounded-lg border border-graphite-border bg-graphite/40">
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {athlete.first_name} {athlete.last_name}{" "}
            <span className="text-xs text-ink-faint">· {SEX_LABEL[athlete.sex]} · {POSITION_LABEL[pos] ?? pos}</span>
          </p>
          <p className="text-xs text-ink-muted">CA {athlete.current_ability} · PA {athlete.potential_ability} · LVL {athlete.level}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}><Pencil className="h-4 w-4" /> Editar</Button>
        <Button size="sm" variant="ghost" onClick={() => remove.mutate(athlete.id)} disabled={remove.isPending}>
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>

      {open && (
        <div className="border-t border-graphite-border p-3">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumField label="Habilidade (CA)" value={ca} onChange={setCa} />
            <NumField label="Potencial (PA)" value={pa} onChange={setPa} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {ATTR_KEYS.map((k) => (
              <NumField key={k} label={ATTRIBUTE_LABEL[k]} value={(attrs[k] as number) ?? 0}
                onChange={(v) => setAttrs((s) => ({ ...s, [k]: v }))} />
            ))}
          </div>
          <div className="mt-3">
            <Button size="sm" onClick={save} disabled={patch.isPending}>
              {patch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="truncate text-ink-faint">{label}</span>
      <input type="number" min={0} max={100} value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
        className="h-8 rounded border border-graphite-border bg-graphite px-2 text-sm text-ink" />
    </label>
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

function TabBtn({
  active, onClick, badge, children,
}: {
  active: boolean; onClick: () => void; badge?: number; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink",
      )}
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
