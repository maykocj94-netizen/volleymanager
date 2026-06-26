import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CircleDot, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/stores/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { setAdminToken } from "@/lib/admin";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Já autenticado → vai para o jogo.
  if (user) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Acesso do dono à central de contas (login: dono / senha: dono).
    if (email.trim().toLowerCase() === "dono" && password === "dono") {
      setAdminToken("dono");
      navigate("/admin", { replace: true });
      return;
    }

    setBusy(true);
    try {
      if (mode === "in") {
        await signInWithEmail(email, password);
        navigate("/", { replace: true });
      } else {
        await signUpWithEmail(email, password);
        setInfo("Conta criada! Verifique seu e-mail para confirmar e depois faça login.");
        setMode("in");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <CircleDot className="h-8 w-8 text-brand" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">Volley Manager</p>
            <p className="text-xs text-ink-faint">
              {mode === "in" ? "Entrar na sua conta" : "Criar uma conta nova"}
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Supabase não configurado. Em desenvolvimento o jogo abre sem login —{" "}
            <button className="underline" onClick={() => navigate("/")}>
              entrar como convidado
            </button>
            . Para ativar contas reais, preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted">E-mail</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="input pl-9"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-muted">Senha</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pl-9"
              />
            </div>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          {mode === "in" ? "Novo por aqui? " : "Já tem conta? "}
          <button
            className="font-semibold text-brand hover:underline"
            onClick={() => {
              setMode((m) => (m === "in" ? "up" : "in"));
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "in" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </Card>
    </div>
  );
}
