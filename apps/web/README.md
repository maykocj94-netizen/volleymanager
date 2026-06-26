# Volley Manager — Web (PWA)

Frontend em React + TypeScript + Vite + TailwindCSS + Shadcn-style + React Query + Zustand, instalável como PWA.

## Rodando

```bash
# a partir da raiz do monorepo:
npm install
cp apps/web/.env.example apps/web/.env   # preencha VITE_SUPABASE_* e VITE_API_URL
npm run dev:web
```

App em http://localhost:5173. Para a partida ao vivo funcionar, rode também a API (`npm run dev:api`).

## Estrutura

```
src/
├── app/          # router, providers
├── components/   # ui (Shadcn-style) + layout
├── features/     # módulos por domínio (dashboard, match, ...)
├── lib/          # api client, supabase, queryClient, utils
├── stores/       # Zustand (auth)
└── index.css     # Tailwind + tema dark
```

## Tema

Escuro por padrão (preto `#0a0a0a`, grafite, laranja `#f97316`, branco). Cores em `tailwind.config.js`.

## PWA

Configurado via `vite-plugin-pwa` (manifest + service worker + cache de leitura para offline parcial).
Ícone em `public/icons/icon.svg` — gere PNGs 192/512 para produção (ver `public/icons/README.md`).

## Build / Deploy

```bash
npm run build:web   # gera apps/web/dist
```

Deploy em Vercel/Netlify apontando para `apps/web` (build: `npm run build`, output: `dist`).
