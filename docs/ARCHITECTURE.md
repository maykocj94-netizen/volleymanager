# Arquitetura — Volley Manager

## Visão geral

Volley Manager é um monorepo dividido em três camadas: **cliente PWA**, **API de jogo** e **infraestrutura gerenciada (Supabase)**.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE (PWA)                            │
│   React + TS + Vite + Tailwind + Shadcn + Zustand + React Query  │
│   Service Worker · Manifest · IndexedDB (offline parcial)        │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ HTTPS (REST, JWT)             │ WSS (WebSocket)
                ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  Controllers → Services → Repositories → Models                 │
│  Engines: Match · Training · Generation · Market · Multiplayer  │
│  Jobs: aging, geração procedural, avanço de ligas               │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ SQLAlchemy async              │ valida JWT (JWKS)
                ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│   PostgreSQL (Supabase)      │   │      Supabase Auth           │
└──────────────────────────────┘   └──────────────────────────────┘
```

## Princípios

1. **Servidor é a fonte da verdade.** Toda simulação de partida, evolução e mercado roda no FastAPI. O cliente nunca calcula resultados de partidas competitivas.
2. **Determinismo por seed.** Cada `match` tem um `seed`. A engine é uma função pura `simulate(state, seed) -> result`. Isso permite reproduzir/auditar partidas e impede trapaça no multiplayer.
3. **Separação de camadas no backend:**
   - **Controllers** (`api/v1`): roteamento, validação de entrada/saída (Pydantic), autenticação.
   - **Services**: regra de negócio, orquestração, transações.
   - **Repositories**: acesso a dados (SQLAlchemy), sem regra de negócio.
   - **Models**: entidades ORM. **Schemas**: DTOs Pydantic.
   - **Engine**: lógica de domínio pura (sem I/O), facilmente testável.
4. **Tipos compartilhados.** `packages/shared` espelha enums e contratos entre front e back para reduzir divergência.

## Autenticação

- Login/cadastro via **Supabase Auth** no cliente (e-mail/senha, OAuth).
- O cliente envia o **access token (JWT)** no header `Authorization: Bearer <jwt>` para o FastAPI.
- O FastAPI valida o JWT usando o segredo/JWKS do projeto Supabase e resolve o `profile` correspondente.
- **RLS** no Postgres protege leituras diretas feitas pelo cliente (quando aplicável).

## Tempo real (WebSockets)

Dois hubs no FastAPI:
- **Live Match Hub** (`/ws/match/{match_id}`): emite eventos de narração conforme a engine avança ponto a ponto.
- **Multiplayer Hub** (`/ws/room/{room_id}`): coordena convite → escalação → tática → início e transmite o jogo aos dois jogadores.

## Fluxo de uma partida (single-player)

1. Cliente cria a partida (`POST /matches`) com escalação + tática.
2. Backend gera `seed`, persiste a partida como `scheduled`.
3. Cliente abre o WS `/ws/match/{id}`; backend roda a engine e faz *streaming* dos eventos.
4. Ao final, resultado, estatísticas e efeitos (moral, cansaço, lesões, evolução) são persistidos.

## Fluxo multiplayer

1. Usuário A → `POST /challenges` (convida B).
2. B aceita → cria `match_room`.
3. Ambos definem escalação/tática (estado sincronizado via WS).
4. Quando os dois estão `ready`, o servidor simula (autoritativo) e transmite a narração para ambos.
5. Resultado afeta ranking.

## Geração procedural e jobs

Tarefas agendadas (APScheduler ou worker externo):
- **Geração de atletas** no início de cada temporada (nome/nacionalidade/potencial/atributos).
- **Envelhecimento** e recálculo de habilidade.
- **Avanço de competições** (rodadas, standings, premiações).

## Deploy

| Componente | Alvo |
|---|---|
| `apps/web` | Vercel ou Netlify (build estático + headers PWA) |
| `apps/api` | Railway (container/uvicorn) |
| DB + Auth | Supabase |

## Decisões registradas (ADR resumido)

- **Supabase em vez de auth próprio:** acelera e dá OAuth/recuperação de senha de graça.
- **FastAPI separado do Supabase Edge Functions:** engine pesada e WebSockets de longa duração ficam melhores num serviço dedicado.
- **npm workspaces (não pnpm):** disponível por padrão no ambiente; o backend Python fica fora do workspace JS.
- **SQLAlchemy async + Alembic:** controle fino de schema e migrations versionadas, complementando o `db/schema.sql` declarativo.
