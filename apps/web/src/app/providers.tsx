import { type ReactNode, useEffect, useState } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { postDailyLogin } from "@/lib/game";
import { useAuth } from "@/stores/auth";

export function Providers({ children }: { children: ReactNode }) {
  const init = useAuth((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <DailyLogin />
      {children}
    </QueryClientProvider>
  );
}

/** Registra o login diário ao abrir o app e avisa quando há bônus de 7 dias. */
function DailyLogin() {
  const qc = useQueryClient();
  const [bonus, setBonus] = useState<number | null>(null);

  useEffect(() => {
    let done = false;
    postDailyLogin()
      .then((res) => {
        if (done) return;
        qc.setQueryData(["me"], res.state);
        if (res.bonus_awarded) setBonus(res.bonus_amount);
      })
      .catch(() => {
        /* API offline em dev — ignora */
      });
    return () => {
      done = true;
    };
  }, [qc]);

  if (bonus == null) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-50 mx-auto w-fit rounded-lg border border-brand bg-surface px-4 py-2 text-sm shadow-lg">
      🎁 Bônus de login de 7 dias: <b className="text-brand">+{bonus} prata</b>!
      <button className="ml-3 text-ink-faint hover:text-ink" onClick={() => setBonus(null)}>
        ✕
      </button>
    </div>
  );
}
