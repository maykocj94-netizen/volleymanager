import { useState } from "react";
import { Loader2, Tag, UserPlus, Hourglass, X } from "lucide-react";
import {
  POSITION_LABEL,
  SEX_LABEL,
  type HireListing,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useClubAthletes, useMe, useMyClub } from "@/lib/game";
import {
  useCancelSale,
  useHireListing,
  useListForSale,
  useListings,
  useMySales,
} from "@/lib/market";
import { AthleteCard } from "@/features/squad/AthleteCard";

type Tab = "hire" | "sell";

export function MarketPage() {
  const [tab, setTab] = useState<Tab>("hire");
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
          Contrate atletas publicados pelo administrador ou coloque seus atletas à venda
          (a venda passa pela aprovação do dono).
        </p>
      </header>

      <div className="flex gap-2">
        <TabButton active={tab === "hire"} onClick={() => setTab("hire")}>
          <UserPlus className="h-4 w-4" /> Contratações
        </TabButton>
        <TabButton active={tab === "sell"} onClick={() => setTab("sell")}>
          <Tag className="h-4 w-4" /> Vender
        </TabButton>
      </div>

      {tab === "hire" ? <HireTab clubId={club?.id} /> : <SellTab clubId={club?.id} />}
    </div>
  );
}

// --- Contratações (anúncios publicados pelo dono) ---
function HireTab({ clubId }: { clubId: string | undefined }) {
  const { data: listings, isLoading } = useListings();
  const { data: me } = useMe();
  const hire = useHireListing(clubId);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {hire.isSuccess && (
        <p className="text-sm text-emerald-400">
          Contratado: {hire.data.athlete.first_name} {hire.data.athlete.last_name}!
        </p>
      )}
      {hire.isError && (
        <p className="text-sm text-red-400">
          {String(hire.error).includes("402")
            ? "Prata insuficiente para contratar."
            : "Anúncio indisponível (já foi contratado)."}
        </p>
      )}
      {!listings?.length ? (
        <Card className="text-ink-muted">
          Nenhum atleta disponível para contratação no momento.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((li) => {
            const canAfford = !!me && me.silver >= li.price;
            return (
              <ListingCard
                key={li.id}
                listing={li}
                footer={
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => hire.mutate(li.id)}
                    disabled={hire.isPending || !canAfford}
                    title={canAfford ? "" : "Prata insuficiente"}
                  >
                    <UserPlus className="h-4 w-4" /> Contratar por{" "}
                    {li.price.toLocaleString("pt-BR")}
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing, footer }: { listing: HireListing; footer: React.ReactNode }) {
  const pos = listing.beach_position ?? listing.court_position ?? "";
  const beach = !!listing.beach_position;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold leading-tight">
            {listing.first_name} {listing.last_name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span
              className={`rounded px-1.5 py-0.5 font-bold uppercase ${
                beach ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-300"
              }`}
            >
              {beach ? "🏖️ Praia" : "🏐 Quadra"}
            </span>
            <span className="text-ink-muted">
              {POSITION_LABEL[pos] ?? pos} · {SEX_LABEL[listing.sex]}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums text-brand">{listing.current_ability}</p>
          <p className="text-[10px] uppercase text-ink-faint">pot {listing.potential_ability}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        ⏳ Validade após contratar: <b className="text-ink-muted">{listing.availability_days} dias</b>
      </p>
      <div className="mt-3 border-t border-graphite-border pt-3">{footer}</div>
    </div>
  );
}

// --- Vender (com aprovação do dono) ---
function SellTab({ clubId }: { clubId: string | undefined }) {
  const { data: athletes, isLoading } = useClubAthletes(clubId);
  const { data: sales } = useMySales();
  const list = useListForSale(clubId);
  const cancel = useCancelSale(clubId);

  if (isLoading) return <Spinner />;
  if (!athletes?.length) return <Card className="text-ink-muted">Elenco vazio.</Card>;

  const pendingByAthlete = new Map((sales ?? []).map((s) => [s.athlete_id, s]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        💡 Ao colocar à venda, o pedido vai para o <b className="text-brand">painel do dono</b>,
        que confirma ou recusa. A prata só é creditada após a aprovação.
      </p>
      {list.isSuccess && (
        <p className="text-sm text-emerald-400">
          Atleta anunciado! Aguardando aprovação do dono.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {athletes.map((a) => {
          const pending = pendingByAthlete.get(a.id) ?? (a.for_sale ? { id: "" } : null);
          return (
            <AthleteCard
              key={a.id}
              athlete={a}
              footer={
                pending ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Hourglass className="h-3.5 w-3.5" /> Aguardando aprovação
                    </span>
                    {pending.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancel.mutate(pending.id)}
                        disabled={cancel.isPending}
                      >
                        <X className="h-4 w-4" /> Cancelar
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="subtle"
                    className="w-full"
                    onClick={() => list.mutate(a.id)}
                    disabled={list.isPending}
                  >
                    <Tag className="h-4 w-4" /> Colocar à venda ({a.sale_value.toLocaleString("pt-BR")})
                  </Button>
                )
              }
            />
          );
        })}
      </div>
    </div>
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
