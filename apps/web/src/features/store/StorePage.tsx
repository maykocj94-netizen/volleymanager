import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShoppingBag, Dumbbell, Coins } from "lucide-react";
import type { Currency, StoreProduct } from "@volley/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/game";
import { useBuyProduct, useProducts } from "@/lib/store";

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
