import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" + registro manual (main.tsx): aplica a nova versão e recarrega
      // sozinho ao detectar um deploy novo, sem o usuário limpar cache.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Volley Manager",
        short_name: "Volley",
        description: "Gerencie equipes de vôlei de praia e de quadra.",
        theme_color: "#f97316",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        // SVG no scaffold. Para produção (maskable iOS/Android), gere PNGs
        // 192/512 a partir de public/icons/icon.svg (ver public/icons/README).
        icons: [
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Remove caches de versões antigas ao ativar a nova (evita ficar preso
        // numa build anterior).
        cleanupOutdatedCaches: true,
        // Offline parcial: cacheia o app shell e respostas GET de leitura.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
