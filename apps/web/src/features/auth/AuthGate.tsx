import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Protege as rotas do jogo.
 * - Sem Supabase configurado (dev): libera o acesso (usuário fixo no backend).
 * - Com Supabase: exige sessão; redireciona para /login caso contrário.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
