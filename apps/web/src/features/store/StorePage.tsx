import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag, Dumbbell, Coins, ArrowRightLeft, ArrowRight } from "lucide-react";
import { SILVER_PER_GOLD, type Currency, type StoreProduct } from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/game";
import { useBuyProduct, useExchange, useProducts } from "@/lib/store";

export function StorePage() {
  const { data: products, isLoading, isError } = useProducts();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShoppingBag className="h-6 w-6 text-brand" /> Loja
          </h1>
          <p className="text-sm text-ink-muted">
            Compre itens para montar seu Centro de Treinamento (CT).
          </p>
        </div>
        <Link to="/ct">
          <Button variant="subtle">
            <Dumbbell className="h-4 w-4" /> Ir para o CT
          </Button>
        </Link>
      </header>

      <Card className="flex items-start gap-3 text-sm text-ink-muted">
        <Coins className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p>
          Cada produto entrega unidades de um item (ex.: postes, refletores, rede, bola).
          Os itens vão para o <b className="text-ink">baú do CT</b>. Junte o necessário e
          monte seu CT de Praia ou de Quadra.
        </p>
      </Card>

      <ExchangeCard />

      {isError ? (
        <Card className="text-ink-muted">
          Não foi possível carregar a loja. Verifique sua conexão.
        </Card>
      ) : isLoading ? (
        <Spinner />
      ) : !products?.length ? (
        <Card className="text-ink-muted">
          Nenhum produto à venda ainda. O administrador publica os itens da loja.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExchangeCard() {
  const { data: me } = useMe();
  const exchange = useExchange();
  const [goldIn, setGoldIn] = useState("");
  const [silverIn, setSilverIn] = useState("");

  const silver = me?.silver ?? 0;
  const gold = me?.gold ?? 0;

  // "Moedas de Prata": gasta ouro → recebe ouro × 10 de prata.
  const goldAmt = Math.max(0, Math.floor(Number(goldIn) || 0));
  const silverOut = goldAmt * SILVER_PER_GOLD;
  const canBuySilver = goldAmt >= 1 && gold >= goldAmt;

  // "Moedas de Ouro": gasta prata → recebe prata ÷ 10 de ouro (mín. 10 prata).
  const silverAmt = Math.max(0, Math.floor(Number(silverIn) || 0));
  const goldOut = Math.floor(silverAmt / SILVER_PER_GOLD);
  const silverCost = goldOut * SILVER_PER_GOLD;
  const canBuyGold = goldOut >= 1 && silver >= silverCost;

  function buySilver() {
    if (!canBuySilver) return;
    exchange.mutate(
      { direction: "to_silver", amount: goldAmt },
      { onSuccess: () => setGoldIn("") },
    );
  }
  function buyGold() {
    if (!canBuyGold) return;
    exchange.mutate(
      { direction: "to_gold", amount: silverAmt },
      { onSuccess: () => setSilverIn("") },
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ArrowRightLeft className="h-5 w-5 text-brand" /> Câmbio de Moedas
        </h2>
        <p className="text-xs text-ink-faint">
          Cotação: <b className="text-ink-muted">1 🥇 = {SILVER_PER_GOLD} 🥈</b> · Saldo:{" "}
          🥈 {silver.toLocaleString("pt-BR")} · 🥇 {gold.toLocaleString("pt-BR")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Moedas de Prata: paga em ouro */}
        <div className="rounded-lg border border-graphite-border bg-graphite/40 p-4">
          <p className="font-semibold">🥈 Moedas de Prata</p>
          <p className="mb-3 text-xs text-ink-faint">Gaste ouro e receba 10× em prata.</p>
          <label className="text-xs text-ink-muted">Ouro a trocar</label>
          <input
            type="number"
            min={1}
            value={goldIn}
            onChange={(e) => setGoldIn(e.target.value)}
            placeholder="ex.: 20"
            className="input mt-1"
          />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-ink-muted">🥇 {goldAmt || 0}</span>
            <ArrowRight className="h-4 w-4 text-ink-faint" />
            <span className="font-bold text-emerald-400">🥈 {silverOut.toLocaleString("pt-BR")}</span>
          </div>
          <Button
            className="mt-3 w-full"
            size="sm"
            onClick={buySilver}
            disabled={exchange.isPending || !canBuySilver}
            title={canBuySilver ? "" : "Ouro insuficiente / informe um valor"}
          >
            {exchange.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🥈"}
            Confirmar troca
          </Button>
        </div>

        {/* Moedas de Ouro: paga em prata */}
        <div className="rounded-lg border border-graphite-border bg-graphite/40 p-4">
          <p className="font-semibold">🥇 Moedas de Ouro</p>
          <p className="mb-3 text-xs text-ink-faint">
            Gaste prata e receba ouro (mín. {SILVER_PER_GOLD} 🥈 = 1 🥇).
          </p>
          <label className="text-xs text-ink-muted">Prata a trocar</label>
          <input
            type="number"
            min={SILVER_PER_GOLD}
            value={silverIn}
            onChange={(e) => setSilverIn(e.target.value)}
            placeholder="ex.: 200"
            className="input mt-1"
          />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-ink-muted">🥈 {silverAmt || 0}</span>
            <ArrowRight className="h-4 w-4 text-ink-faint" />
            <span className="font-bold text-amber-400">🥇 {goldOut.toLocaleString("pt-BR")}</span>
          </div>
          {silverAmt > 0 && silverAmt !== silverCost && goldOut >= 1 && (
            <p className="mt-1 text-[11px] text-ink-faint">
              Serão usados {silverCost} 🥈 (o resto, {silverAmt - silverCost} 🥈, fica na carteira).
            </p>
          )}
          <Button
            className="mt-3 w-full"
            size="sm"
            variant="subtle"
            onClick={buyGold}
            disabled={exchange.isPending || !canBuyGold}
            title={canBuyGold ? "" : `Mínimo ${SILVER_PER_GOLD} de prata`}
          >
            {exchange.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🥇"}
            Confirmar troca
          </Button>
        </div>
      </div>

      {exchange.isError && (
        <p className="text-sm text-red-400">
          Não foi possível concluir a troca. Verifique o saldo e o valor mínimo.
        </p>
      )}
      {exchange.isSuccess && exchange.data && (
        <p className="text-sm text-emerald-400">
          Troca concluída!{" "}
          {exchange.data.silver_delta >= 0
            ? `+${exchange.data.silver_delta} 🥈`
            : `${exchange.data.silver_delta} 🥈`}{" "}
          ·{" "}
          {exchange.data.gold_delta >= 0
            ? `+${exchange.data.gold_delta} 🥇`
            : `${exchange.data.gold_delta} 🥇`}
        </p>
      )}
    </Card>
  );
}

function ProductCard({ product: p }: { product: StoreProduct }) {
  const { data: me } = useMe();
  const buy = useBuyProduct();
  const [bought, setBought] = useState<number>(0);

  const canSilver = p.price_silver > 0;
  const canGold = p.price_gold > 0;
  const enoughSilver = (me?.silver ?? 0) >= p.price_silver;
  const enoughGold = (me?.gold ?? 0) >= p.price_gold;

  function purchase(currency: Currency) {
    buy.mutate(
      { productId: p.id, currency },
      { onSuccess: () => setBought((n) => n + 1) },
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-graphite text-2xl">
          {p.image_url ? (
            <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span>{p.item_emoji}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{p.name}</p>
          <p className="text-xs text-ink-muted">
            Entrega {p.quantity}× {p.item_emoji} {p.item_label}
          </p>
        </div>
      </div>

      {p.description && <p className="text-xs text-ink-faint">{p.description}</p>}

      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
          {canSilver && <span>🥈 {p.price_silver.toLocaleString("pt-BR")}</span>}
          {canGold && <span>🥇 {p.price_gold.toLocaleString("pt-BR")}</span>}
          {!canSilver && !canGold && <span>Grátis</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canSilver && (
            <Button
              size="sm"
              onClick={() => purchase("silver")}
              disabled={buy.isPending || !enoughSilver}
              title={enoughSilver ? "" : "Prata insuficiente"}
            >
              {buy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🥈"}
              Comprar (prata)
            </Button>
          )}
          {canGold && (
            <Button
              size="sm"
              variant="subtle"
              onClick={() => purchase("gold")}
              disabled={buy.isPending || !enoughGold}
              title={enoughGold ? "" : "Ouro insuficiente"}
            >
              {buy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🥇"}
              Comprar (ouro)
            </Button>
          )}
        </div>
        {bought > 0 && (
          <p className="text-xs text-emerald-400">
            ✓ {bought} comprado(s) — item enviado ao baú do CT.
          </p>
        )}
      </div>
    </Card>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16 text-ink-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
