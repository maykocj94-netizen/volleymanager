import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, LogOut, Loader2, Pencil, Plus, Save, Trash2, Shield } from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  Modality,
  POSITION_LABEL,
  SEX_LABEL,
  type AdminUser,
  type Athlete,
  type AthleteAttributes,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  clearAdminToken,
  useAdminAddAthlete,
  useAdminAthletes,
  useAdminCoins,
  useAdminPatchAthlete,
  useAdminRemoveAthlete,
  useAdminUsers,
} from "@/lib/admin";

export function AdminPanel() {
  const navigate = useNavigate();
  const { data: users, isLoading, isError } = useAdminUsers();
  const [selId, setSelId] = useState<string | null>(null);
  const selected = users?.find((u) => u.user_id === selId) ?? users?.[0] ?? null;

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
            <p className="text-sm text-ink-muted">Painel do dono — gerencie usuários e elencos.</p>
          </div>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sair do admin
        </Button>
      </header>

      {isError && (
        <Card className="text-red-400">
          Não foi possível carregar (token inválido ou API offline). Faça login como dono novamente.
        </Card>
      )}
      {isLoading && <Spinner />}

      {users && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Lista de usuários */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              Usuários ({users.length})
            </p>
            {users.map((u) => (
              <UserRow
                key={u.user_id}
                user={u}
                active={selected?.user_id === u.user_id}
                onClick={() => setSelId(u.user_id)}
              />
            ))}
            {users.length === 0 && <p className="text-sm text-ink-muted">Nenhum usuário ainda.</p>}
          </div>

          {/* Detalhe do usuário selecionado */}
          {selected ? (
            <UserDetail user={selected} />
          ) : (
            <Card className="text-ink-muted">Selecione um usuário.</Card>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, active, onClick }: { user: AdminUser; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-brand bg-graphite-light"
          : "border-graphite-border bg-surface hover:bg-graphite-light",
      )}
    >
      <p className="font-semibold">{user.club_name ?? "(sem clube)"}</p>
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
  const addAthlete = useAdminAddAthlete(user.user_id);
  const [mod, setMod] = useState<Modality>(Modality.BEACH_M);
  const [silverDelta, setSilverDelta] = useState(1000);
  const [goldDelta, setGoldDelta] = useState(10);

  return (
    <div className="space-y-4">
      {/* Moedas */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Coins className="h-5 w-5 text-brand" />
          <h2 className="font-semibold">Moedas — {user.club_name}</h2>
          <span className="ml-auto text-sm text-ink-muted">
            🥈 {user.silver} · 🥇 {user.gold}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CoinControl
            label="Prata"
            value={silverDelta}
            onChange={setSilverDelta}
            onAdd={() => coins.mutate({ userId: user.user_id, silver_delta: silverDelta, gold_delta: 0 })}
            onSub={() => coins.mutate({ userId: user.user_id, silver_delta: -silverDelta, gold_delta: 0 })}
            busy={coins.isPending}
          />
          <CoinControl
            label="Ouro"
            value={goldDelta}
            onChange={setGoldDelta}
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

function CoinControl({
  label,
  value,
  onChange,
  onAdd,
  onSub,
  busy,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onAdd: () => void;
  onSub: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="text-ink-muted">{label} (quantidade)</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 rounded-lg border border-graphite-border bg-graphite px-2 text-ink"
        />
      </label>
      <Button size="sm" variant="subtle" onClick={onAdd} disabled={busy}>
        + Adicionar
      </Button>
      <Button size="sm" variant="outline" onClick={onSub} disabled={busy}>
        − Remover
      </Button>
    </div>
  );
}

const ATTR_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof AthleteAttributes)[];

function AthleteAdminRow({ athlete, userId }: { athlete: Athlete; userId: string }) {
  const patch = useAdminPatchAthlete(userId);
  const remove = useAdminRemoveAthlete(userId);
  const [open, setOpen] = useState(false);
  const [ca, setCa] = useState(athlete.current_ability);
  const [pa, setPa] = useState(athlete.potential_ability);
  const [attrs, setAttrs] = useState<AthleteAttributes>(
    athlete.attributes ?? ({} as AthleteAttributes),
  );
  const pos = athlete.beach_position ?? athlete.court_position ?? "";

  function save() {
    patch.mutate({
      athleteId: athlete.id,
      body: { current_ability: ca, potential_ability: pa, attributes: attrs },
    });
    setOpen(false);
  }

  return (
    <div className="rounded-lg border border-graphite-border bg-graphite/40">
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {athlete.first_name} {athlete.last_name}{" "}
            <span className="text-xs text-ink-faint">
              · {SEX_LABEL[athlete.sex]} · {POSITION_LABEL[pos] ?? pos}
            </span>
          </p>
          <p className="text-xs text-ink-muted">
            CA {athlete.current_ability} · PA {athlete.potential_ability}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
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
              <NumField
                key={k}
                label={ATTRIBUTE_LABEL[k]}
                value={(attrs[k] as number) ?? 0}
                onChange={(v) => setAttrs((s) => ({ ...s, [k]: v }))}
              />
            ))}
          </div>
          <div className="mt-3">
            <Button size="sm" onClick={save} disabled={patch.isPending}>
              {patch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="truncate text-ink-faint">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
        className="h-8 rounded border border-graphite-border bg-graphite px-2 text-sm text-ink"
      />
    </label>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
