import { Coins } from "lucide-react";
import { useMe } from "@/lib/game";
import { cn } from "@/lib/utils";

/** Mostra o saldo de prata e ouro do jogador. */
export function Wallet({ className }: { className?: string }) {
  const { data: me } = useMe();
  return (
    <div className={cn("flex items-center gap-3 text-sm font-semibold tabular-nums", className)}>
      <span className="flex items-center gap-1 text-zinc-300" title="Moedas de prata">
        <Coins className="h-4 w-4 text-zinc-400" />
        {me ? me.silver.toLocaleString("pt-BR") : "—"}
      </span>
      <span className="flex items-center gap-1 text-amber-300" title="Moedas de ouro">
        <Coins className="h-4 w-4 text-amber-400" />
        {me ? me.gold.toLocaleString("pt-BR") : "—"}
      </span>
    </div>
  );
}
