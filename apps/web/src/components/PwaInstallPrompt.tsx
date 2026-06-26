import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "volley_pwa_dismissed";

/**
 * Banner para instalar o PWA (principalmente no desktop, onde o jogo fica com
 * cara de app). Aparece quando o navegador dispara `beforeinstallprompt`.
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1",
  );

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setHidden(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function dismiss() {
    setHidden(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 shrink-0 text-brand" />
        <p className="text-sm">
          <b>Instale o Volley Manager</b> no seu {isDesktop() ? "computador" : "celular"} para
          jogar como um app, em tela cheia.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={install}>
          <Download className="h-4 w-4" /> Instalar
        </Button>
        <button onClick={dismiss} className="rounded p-1 text-ink-faint hover:text-ink" aria-label="Dispensar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function isDesktop() {
  return window.matchMedia("(min-width: 768px)").matches;
}
