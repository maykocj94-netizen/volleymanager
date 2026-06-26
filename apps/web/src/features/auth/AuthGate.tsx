import { type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Hourglass, Loader2, LogOut, RefreshCw, WifiOff } from "lucide-react";
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
 *
 * Em qualquer estado de espera/erro há sempre um botão "Voltar ao login" — o
 * usuário nunca fica preso em carregamento.
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

function ApprovalGate({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError, refetch, isFetching } = useMe();

  if (isError) {
    return (
      <GateScreen
        icon={<WifiOff className="mx-auto h-10 w-10 text-red-400" />}
        title="Não foi possível conectar ao servidor"
        text="O servidor pode estar 'acordando' (no plano grátis isso leva ~50s no primeiro acesso). Tente de novo ou volte ao login."
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  if (isLoading || !me) {
    return (
      <GateScreen
        icon={<Loader2 className="mx-auto h-10 w-10 animate-spin text-brand" />}
        title="Carregando o jogo…"
        text="No primeiro acesso o servidor pode levar até ~1 minuto para acordar. Se demorar demais, volte ao login e tente entrar de novo."
      />
    );
  }

  if (me.approved) return <>{children}</>;

  return (
    <GateScreen
      icon={<Hourglass className="mx-auto h-10 w-10 text-brand" />}
      title="Aguardando Aprovação de Entrada"
      text="Sua conta foi criada e está aguardando a liberação do administrador. Assim que for aprovada, você poderá jogar normalmente."
      onRetry={() => void refetch()}
      retrying={isFetching}
    />
  );
}

function GateScreen({
  icon,
  title,
  text,
  onRetry,
  retrying,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function backToLogin() {
    try {
      await signOut();
    } catch {
      // sem Supabase / sem sessão — segue para o login mesmo assim
    }
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        {icon}
        <h1 className="mt-4 text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{text}</p>
        <div className="mt-5 flex flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} disabled={retrying}>
              <RefreshCw className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Tentar de novo
            </Button>
          )}
          <Button variant="ghost" onClick={backToLogin}>
            <LogOut className="h-4 w-4" /> Voltar ao login
          </Button>
        </div>
      </Card>
    </div>
  );
}
