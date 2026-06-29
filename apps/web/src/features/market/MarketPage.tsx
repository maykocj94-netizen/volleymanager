import { useState } from "react";
import { Loader2, Tag, UserPlus, ShoppingCart, X, Info } from "lucide-react";
import {
  ATTRIBUTE_LABEL,
  POSITION_LABEL,
  SEX_LABEL,
  type Athlete,
  type AthleteAttributes,
  type HireListing,
  type MarketSale,
} from "@volley/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useClubAthletes, useMe, useMyClub } from "@/lib/game";
import {
  useBuyAthlete,
  useForSale,
  useHireListing,
  useListForSale,
  useListings,
  useUnlist,
} from "@/lib/market";
import { AthleteCard, AthleteDetail } from "@/features/squad/AthleteCard";

type Tab = "hire" | "buy" | "sell";

/** Preço em ouro de um atleta (1 ouro = 10 prata). */
const goldPrice = (silverValue: number) => Math.max(1, Math.round((silverValue || 0) / 10));

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
          Contrate atletas do administrador, compre atletas de outros usuários (em ouro) ou
          coloque os seus à venda.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "hire"} onClick={() => setTab("hire")}>
          <UserPlus className="h-4 w-4" /> Contratações
        </TabButton>
        <TabButton active={tab === "buy"} onClick={() => setTab("buy")}>
          <ShoppingCart className="h-4 w-4" /> Comprar
        </TabButton>
        <TabButton active={tab === "sell"} onClick={() => setTab("sell")}>
          <Tag className="h-4 w-4" /> Vender
        </TabButton>
      </div>

      {tab === "hire" && <HireTab clubId={club?.id} />}
      {tab === "buy" && <BuyTab clubId={club?.id} />}
      {tab === "sell" && <SellTab clubId={club?.id} />}
    </div>
  );
}

// --- Contratações (anúncios publicados pelo dono) ---
function HireTab({ clubId }: { clubId: string | undefined }) {
  const { data: listings, isLoading } = useListings();
  const { data: me } = useMe();
  const hire = useHireListing(clubId);
  const [info, setInfo] = useState<HireListing | null>(null);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {info && <ListingDetail listing={info} onClose={() => setInfo(null)} />}
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
            const canSilver = !!me && me.silver >= li.price;
            const canGold = li.price_gold > 0 && !!me && me.gold >= li.price_gold;
            return (
              <ListingCard
                key={li.id}
                listing={li}
                onInfo={() => setInfo(li)}
                footer={
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => hire.mutate({ listingId: li.id, currency: "silver" })}
                      disabled={hire.isPending || !canSilver}
                      title={canSilver ? "" : "Prata insuficiente"}
                    >
                      <UserPlus className="h-4 w-4" /> 🥈 {li.price.toLocaleString("pt-BR")} prata
                    </Button>
                    {li.price_gold > 0 && (
                      <Button
                        size="sm"
                        variant="subtle"
                        className="w-full"
                        onClick={() => hire.mutate({ listingId: li.id, currency: "gold" })}
                        disabled={hire.isPending || !canGold}
                        title={canGold ? "" : "Ouro insuficiente"}
                      >
                        <UserPlus className="h-4 w-4" /> 🥇 {li.price_gold.toLocaleString("pt-BR")} ouro
                      </Button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListingCard({
  listing, footer, onInfo,
}: {
  listing: HireListing; footer: React.ReactNode; onInfo: () => void;
}) {
  const both = !!listing.beach_position && !!listing.court_position;
  const beach = !!listing.beach_position;
  const discipline = both ? "🏖️🏐 Ambos" : beach ? "🏖️ Praia" : "🏐 Quadra";
  const positions = [
    listing.beach_position && POSITION_LABEL[listing.beach_position],
    listing.court_position && POSITION_LABEL[listing.court_position],
  ]
    .filter(Boolean)
    .join(" / ");
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-semibold leading-tight">
            {listing.first_name} {listing.last_name}
            <button
              onClick={onInfo}
              className="text-ink-faint hover:text-brand"
              title="Ver habilidades do atleta"
            >
              <Info className="h-4 w-4" />
            </button>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span
              className={`rounded px-1.5 py-0.5 font-bold uppercase ${
                both
                  ? "bg-emerald-500/20 text-emerald-300"
                  : beach
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-indigo-500/20 text-indigo-300"
              }`}
            >
              {discipline}
            </span>
            <span className="text-ink-muted">
              {positions} · {SEX_LABEL[listing.sex]} · {listing.age} anos
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums text-brand">{listing.current_ability}</p>
          <p className="text-[10px] uppercase text-ink-faint">pot {listing.potential_ability}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        📏 {listing.height_cm}cm · {listing.weight_kg}kg · ⏳ validade {listing.availability_days} dias
      </p>
      <div className="mt-3 border-t border-graphite-border pt-3">{footer}</div>
    </div>
  );
}

const ATTR_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof AthleteAttributes)[];

function rating(v: number) {
  if (v >= 80) return "text-emerald-400";
  if (v >= 65) return "text-brand";
  if (v >= 50) return "text-ink";
  return "text-ink-muted";
}

/** Modal com as habilidades de um anúncio de contratação. */
function ListingDetail({ listing, onClose }: { listing: HireListing; onClose: () => void }) {
  const attrs = listing.attributes ?? {};
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-graphite-border bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold leading-tight">{listing.first_name} {listing.last_name}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {SEX_LABEL[listing.sex]} · {listing.age} anos · {listing.height_cm}cm · {listing.weight_kg}kg
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-black tabular-nums ${rating(listing.current_ability)}`}>{listing.current_ability}</p>
            <p className="text-[10px] uppercase text-ink-faint">pot {listing.potential_ability}</p>
            <button onClick={onClose} className="mt-1 text-ink-faint hover:text-ink"><X className="ml-auto h-5 w-5" /></button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {ATTR_KEYS.map((k) => (
            <div key={k} className="rounded bg-graphite px-2 py-1.5 text-center">
              <p className={`text-base font-bold tabular-nums ${rating((attrs as Record<string, number>)[k] ?? 0)}`}>
                {(attrs as Record<string, number>)[k] ?? "—"}
              </p>
              <p className="text-[9px] uppercase leading-tight text-ink-faint">{ATTRIBUTE_LABEL[k]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Comprar (mercado P2P: atletas à venda por outros usuários) ---
function BuyTab({ clubId }: { clubId: string | undefined }) {
  const { data: sales, isLoading } = useForSale();
  const { data: me } = useMe();
  const buy = useBuyAthlete(clubId);
  const [detail, setDetail] = useState<Athlete | null>(null);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {detail && <AthleteDetail athlete={detail} onClose={() => setDetail(null)} />}
      <p className="text-sm text-ink-muted">
        🛒 Atletas colocados à venda por outros treinadores. A compra é paga em{" "}
        <b className="text-amber-300">ouro</b> e vai direto para o vendedor.
      </p>
      {buy.isError && (
        <p className="text-sm text-red-400">
          {String(buy.error).includes("402")
            ? "Ouro insuficiente para comprar."
            : "Atleta não está mais disponível."}
        </p>
      )}
      {!sales?.length ? (
        <Card className="text-ink-muted">Nenhum atleta à venda no momento.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sales.map((s) => (
            <BuyCard
              key={s.athlete.id}
              sale={s}
              canBuy={!!me && me.gold >= s.price_gold}
              busy={buy.isPending}
              onInfo={() => setDetail(s.athlete)}
              onBuy={() => buy.mutate(s.athlete.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BuyCard({
  sale, canBuy, busy, onInfo, onBuy,
}: {
  sale: MarketSale; canBuy: boolean; busy: boolean; onInfo: () => void; onBuy: () => void;
}) {
  const a = sale.athlete;
  const pos = a.beach_position ?? a.court_position ?? "";
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold leading-tight">
            <button onClick={onInfo} className="truncate hover:text-brand hover:underline" title="Ver estatísticas">
              {a.first_name} {a.last_name}
            </button>
            <button onClick={onInfo} className="text-ink-faint hover:text-brand"><Info className="h-4 w-4" /></button>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {POSITION_LABEL[pos] ?? pos} · {SEX_LABEL[a.sex]} · LVL {a.level}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">Vendedor: {sale.seller_name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums text-brand">{a.current_ability}</p>
          <p className="text-[10px] uppercase text-ink-faint">pot {a.potential_ability}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-graphite-border pt-3">
        <Button
          size="sm"
          className="w-full"
          onClick={onBuy}
          disabled={busy || !canBuy}
          title={canBuy ? "" : "Ouro insuficiente"}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
          Comprar por 🥇 {sale.price_gold.toLocaleString("pt-BR")}
        </Button>
      </div>
    </div>
  );
}

// --- Vender (mercado P2P em ouro) ---
function SellTab({ clubId }: { clubId: string | undefined }) {
  const { data: athletes, isLoading } = useClubAthletes(clubId);
  const list = useListForSale(clubId);
  const unlist = useUnlist(clubId);

  if (isLoading) return <Spinner />;
  if (!athletes?.length) return <Card className="text-ink-muted">Elenco vazio.</Card>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        💡 Ao colocar à venda, seu atleta fica visível na aba <b className="text-brand">Comprar</b> dos
        outros usuários. Quando alguém comprar, você recebe o valor em <b className="text-amber-300">ouro</b>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {athletes.map((a) => (
          <AthleteCard
            key={a.id}
            athlete={a}
            footer={
              a.listing_id ? (
                <span className="flex items-center gap-1 text-xs text-ink-faint">
                  🔒 Contratação — não pode ser vendida
                </span>
              ) : a.for_sale ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-amber-300">
                    🏷️ À venda por 🥇 {(a.sale_listed_price ?? goldPrice(a.sale_value)).toLocaleString("pt-BR")}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => unlist.mutate(a.id)} disabled={unlist.isPending}>
                    <X className="h-4 w-4" /> Tirar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="subtle"
                  className="w-full"
                  onClick={() => list.mutate(a.id)}
                  disabled={list.isPending}
                >
                  <Tag className="h-4 w-4" /> Vender por 🥇 {goldPrice(a.sale_value).toLocaleString("pt-BR")}
                </Button>
              )
            }
          />
        ))}
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
