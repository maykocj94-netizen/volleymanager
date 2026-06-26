import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Hourglass, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/stores/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useMe } from "@/lib/game";

/**
 * Protege as rotas do jogo.
 * - Sem Supabase configurado (dev): libera o acesso (usuário fixo no backend).
 * - Com Supabase: exige sessão; redireciona para /login caso contrário.
 * - Em ambos os casos, exige que a conta esteja APROVADA pelo dono.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (isSupabaseConfigured) {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center text-ink-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    if (!user) return <Navigate to="/login" replace />;
  }
  return <ApprovalGate>{children}</ApprovalGate>;
}

/** Bloqueia a conta até o dono aprovar a entrada. */
function ApprovalGate({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError, refetch, isFetching } = useMe();
  const { signOut } = useAuth();

  // Falha de API (backend offline) não deve travar; deixa o app lidar com o erro.
  if (isError) return <>{children}</>;
  if (isLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (me.approved) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <Hourglass className="mx-auto h-10 w-10 text-brand" />
        <h1 className="mt-4 text-lg font-bold">Aguardando Aprovação de Entrada</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sua conta foi criada e está aguardando a liberação do administrador.
          Assim que for aprovada, você poderá jogar normalmente.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Verificar de novo
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}
