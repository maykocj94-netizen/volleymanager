import { useState } from "react";
import { Loader2, Tag, UserPlus, Plus } from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  BeachPosition,
  CourtPosition,
  Modality,
  POSITION_LABEL,
  Sex,
  SEX_LABEL,
  type AthleteAttributes,
  type CustomAthleteCreate,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  useClubAthletes,
  useCreateCustom,
  useCustomAthletes,
  useMe,
  useMyClub,
  useSellAthlete,
  useSignCustom,
} from "@/lib/game";
import { AthleteCard } from "@/features/squad/AthleteCard";

type Tab = "sell" | "hire";

export function MarketPage() {
  const [tab, setTab] = useState<Tab>("sell");
  const { club, isError } = useMyClub();

  if (isError) {
    return (
      <Card className="text-ink-muted">
        Não foi possível conectar à API. Rode o backend (porta 8000).
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Mercado de Transferências</h1>
        <p className="text-sm text-ink-muted">
          Venda atletas (valor varia com o desempenho) ou contrate atletas personalizados.
        </p>
      </header>

      <div className="flex gap-2">
        <TabButton active={tab === "sell"} onClick={() => setTab("sell")}>
          <Tag className="h-4 w-4" /> Vendas
        </TabButton>
        <TabButton active={tab === "hire"} onClick={() => setTab("hire")}>
          <UserPlus className="h-4 w-4" /> Contratações
        </TabButton>
      </div>

      {tab === "sell" ? <SellTab clubId={club?.id} /> : <HireTab clubId={club?.id} />}
    </div>
  );
}

function SellTab({ clubId }: { clubId: string | undefined }) {
  const { data: athletes, isLoading } = useClubAthletes(clubId);
  const sell = useSellAthlete(clubId);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (isLoading) return <Spinner />;
  if (!athletes?.length) return <Card className="text-ink-muted">Elenco vazio.</Card>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        💡 Cada <b className="text-emerald-400">vitória</b> valoriza o atleta; cada{" "}
        <b className="text-red-400">derrota</b> desvaloriza. O valor abaixo já reflete o histórico.
      </p>
      {sell.isSuccess && (
        <p className="text-sm text-emerald-400">
          Atleta vendido por {sell.data.value.toLocaleString("pt-BR")} de prata!
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {athletes.map((a) => (
          <AthleteCard
            key={a.id}
            athlete={a}
            footer={
              confirmId === a.id ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      sell.mutate(a.id);
                      setConfirmId(null);
                    }}
                    disabled={sell.isPending}
                  >
                    Confirmar venda
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="subtle" className="w-full" onClick={() => setConfirmId(a.id)}>
                  <Tag className="h-4 w-4" /> Vender por {a.sale_value.toLocaleString("pt-BR")}
                </Button>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function HireTab({ clubId }: { clubId: string | undefined }) {
  const { data: customs, isLoading } = useCustomAthletes();
  const { data: me } = useMe();
  const sign = useSignCustom(clubId);

  return (
    <div className="space-y-6">
      <CustomAthleteForm />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Disponíveis para contratar</h2>
        {sign.isSuccess && (
          <p className="mb-3 text-sm text-emerald-400">
            Contratado: {sign.data.athlete.first_name} {sign.data.athlete.last_name}!
          </p>
        )}
        {sign.isError && (
          <p className="mb-3 text-sm text-red-400">Prata insuficiente para contratar.</p>
        )}
        {isLoading ? (
          <Spinner />
        ) : !customs?.length ? (
          <Card className="text-ink-muted">
            Nenhum atleta personalizado ainda. Crie um acima — ele aparecerá aqui para contratação.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customs.map((a) => {
              const canAfford = !!me && me.silver >= a.market_value;
              return (
                <AthleteCard
                  key={a.id}
                  athlete={a}
                  footer={
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => sign.mutate(a.id)}
                      disabled={sign.isPending || !canAfford}
                      title={canAfford ? "" : "Prata insuficiente"}
                    >
                      <UserPlus className="h-4 w-4" /> Contratar por{" "}
                      {a.market_value.toLocaleString("pt-BR")}
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const ATTR_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof AthleteAttributes)[];

function CustomAthleteForm() {
  const create = useCreateCustom();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<Sex>(Sex.MALE);
  const [discipline, setDiscipline] = useState<"beach" | "indoor">("beach");
  const [beachPos, setBeachPos] = useState<BeachPosition>(BeachPosition.UNIVERSAL);
  const [courtPos, setCourtPos] = useState<CourtPosition>(CourtPosition.OUTSIDE);
  const [attrs, setAttrs] = useState<AthleteAttributes>(() =>
    ATTR_KEYS.reduce((acc, k) => ({ ...acc, [k]: 60 }), {} as AthleteAttributes),
  );

  function submit() {
    const body: CustomAthleteCreate = {
      first_name: firstName.trim() || "Atleta",
      last_name: lastName.trim() || "Personalizado",
      country: "BRA",
      sex,
      modality:
        discipline === "beach"
          ? sex === Sex.MALE
            ? Modality.BEACH_M
            : Modality.BEACH_F
          : sex === Sex.MALE
            ? Modality.INDOOR_M
            : Modality.INDOOR_F,
      beach_position: discipline === "beach" ? beachPos : null,
      court_position: discipline === "indoor" ? courtPos : null,
      height_cm: 190,
      weight_kg: 85,
      attributes: attrs,
    };
    create.mutate(body, {
      onSuccess: () => {
        setFirstName("");
        setLastName("");
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-brand" /> Criar atleta personalizado
            </CardTitle>
            <CardDescription>
              Defina sexo, posição e atributos. Ele entra na lista de contratações.
            </CardDescription>
          </div>
          <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
        </button>
      </CardHeader>

      {open && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nome"
                className="input"
              />
            </Field>
            <Field label="Sobrenome">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Sobrenome"
                className="input"
              />
            </Field>
            <Field label="Sexo">
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className="input">
                <option value={Sex.MALE}>{SEX_LABEL.male}</option>
                <option value={Sex.FEMALE}>{SEX_LABEL.female}</option>
              </select>
            </Field>
            <Field label="Disciplina">
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as "beach" | "indoor")}
                className="input"
              >
                <option value="beach">Praia</option>
                <option value="indoor">Quadra</option>
              </select>
            </Field>
            <Field label="Posição">
              {discipline === "beach" ? (
                <select
                  value={beachPos}
                  onChange={(e) => setBeachPos(e.target.value as BeachPosition)}
                  className="input"
                >
                  {Object.values(BeachPosition).map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABEL[p] ?? p}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={courtPos}
                  onChange={(e) => setCourtPos(e.target.value as CourtPosition)}
                  className="input"
                >
                  {Object.values(CourtPosition).map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABEL[p] ?? p}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm text-ink-muted">Atributos (1–99)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ATTR_KEYS.map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded bg-graphite px-2 py-1 text-xs">
                  <span className="text-ink-muted">{ATTRIBUTE_LABEL[k]}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={attrs[k]}
                    onChange={(e) =>
                      setAttrs((s) => ({
                        ...s,
                        [k]: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-14 rounded border border-graphite-border bg-surface px-1 py-0.5 text-center text-ink"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar atleta
            </Button>
            {create.isSuccess && <span className="text-sm text-emerald-400">Atleta criado!</span>}
          </div>
        </div>
      )}
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-brand text-black" : "bg-graphite text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
