import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import "./index.css";

// Atualização automática do PWA: ao detectar uma versão nova publicada (no
// carregamento ou na checagem periódica), aplica e recarrega sozinho — o
// usuário não precisa limpar cache nem reinstalar.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Verifica se há uma versão nova a cada 60s enquanto o app está aberto.
      setInterval(() => registration.update(), 60 * 1000);
    }
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
);
