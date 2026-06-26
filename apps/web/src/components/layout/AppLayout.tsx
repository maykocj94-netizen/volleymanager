import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Swords,
  Globe,
  Trophy,
  ShoppingBag,
  CircleDot,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wallet } from "@/components/Wallet";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { useAuth } from "@/stores/auth";

const nav = [
  { to: "/", label: "Painel", short: "Painel", icon: LayoutDashboard, end: true },
  { to: "/elenco", label: "Elenco", short: "Elenco", icon: Users },
  { to: "/mercado", label: "Mercado", short: "Mercado", icon: ArrowLeftRight },
  { to: "/partida", label: "Partida Single", short: "Single", icon: Swords },
  { to: "/partida-online", label: "Partida Online", short: "Online", icon: Globe },
  { to: "/competicoes", label: "Competições", short: "Torneios", icon: Trophy },
  { to: "/loja", label: "Loja", short: "Loja", icon: ShoppingBag },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-graphite-border bg-surface p-4 md:flex md:flex-col">
        <Brand />
        <Wallet className="mt-5 rounded-lg bg-graphite px-3 py-2" />
        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto pt-6">
          <SignOutButton />
        </div>
      </aside>

      {/* Top bar (mobile): marca + carteira */}
      <header className="flex items-center justify-between border-b border-graphite-border bg-surface px-4 py-3 md:hidden">
        <Brand />
        <Wallet />
      </header>

      {/* Conteúdo */}
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8">
        <PwaInstallPrompt />
        <Outlet />
      </main>

      {/* Bottom nav (mobile) — rolável p/ caber todos os itens + Sair */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-graphite-border bg-surface md:hidden">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2 text-[10px]",
                isActive ? "text-brand" : "text-ink-muted",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.short}
          </NavLink>
        ))}
        <SignOutButton mobile />
      </nav>
    </div>
  );
}

function SignOutButton({ mobile }: { mobile?: boolean }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handle() {
    try {
      await signOut();
    } catch {
      // sem Supabase configurado — segue para a tela de login mesmo assim
    }
    navigate("/login", { replace: true });
  }

  if (mobile) {
    return (
      <button
        onClick={handle}
        className="flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2 text-[10px] text-ink-muted"
      >
        <LogOut className="h-5 w-5" />
        Sair
      </button>
    );
  }
  return (
    <button
      onClick={handle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-graphite-light hover:text-ink"
    >
      <LogOut className="h-4.5 w-4.5" />
      Sair
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <CircleDot className="h-7 w-7 text-brand" />
      <div className="leading-tight">
        <p className="font-bold tracking-tight">Volley</p>
        <p className="text-xs text-ink-faint">Manager</p>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-graphite-light text-brand"
            : "text-ink-muted hover:bg-graphite-light hover:text-ink",
        )
      }
    >
      <Icon className="h-4.5 w-4.5" />
      {label}
    </NavLink>
  );
}
