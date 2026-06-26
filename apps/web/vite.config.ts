import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
