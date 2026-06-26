# 🚀 Deploy — publicar o jogo (Netlify + Render + Supabase)

O site publicado mostra **"API offline"** porque o frontend estático não tem
um backend acessível pela internet (ele aponta para `localhost:8000`, que só
existe no seu PC). Para o jogo publicado funcionar de verdade, são **3 peças**:

```
┌────────────────────┐   HTTPS    ┌───────────────────────┐   asyncpg   ┌──────────────────┐
│  Netlify (frontend)│ ─────────► │  Render (backend API) │ ──────────► │ Supabase Postgres│
│  React/PWA         │  + JWT     │  FastAPI (Docker)     │             │  +  Supabase Auth│
└────────────────────┘            └───────────────────────┘             └──────────────────┘
```

Tudo já está preparado no projeto (Dockerfile, `render.yaml`, conexão asyncpg
com SSL, criação automática de tabelas e onboarding por usuário). Falta só
**criar as contas na nuvem e preencher as variáveis**. Siga na ordem.

---

## Passo 1 — Supabase (banco + login) · grátis

1. Crie um projeto em <https://supabase.com> (anote a **senha do banco**).
2. **Project Settings → API**, copie:
   - **Project URL** → `https://XXXX.supabase.co`
   - **anon public key** (uma chave longa `eyJ...`)
   - **JWT Secret** (em *JWT Settings*)
3. **Project Settings → Database → Connection string → "Session pooler"**.
   Copie a string (formato `postgresql://postgres.XXXX:[SENHA]@aws-...pooler.supabase.com:5432/postgres`)
   e **troque o esquema** para o driver assíncrono:
   ```
   postgresql+asyncpg://postgres.XXXX:SUA_SENHA@aws-0-...pooler.supabase.com:5432/postgres
   ```
   > Use o **Session pooler** (IPv4) — funciona no Render. A app já envia SSL e
   > `statement_cache_size=0` (compatível com o pooler).
4. **Authentication → Providers → Email**: deixe habilitado. Para testar rápido,
   em **Authentication → Sign In / Providers → Email**, você pode **desligar
   "Confirm email"** (assim a conta criada já entra sem confirmar e-mail).

As tabelas do jogo são criadas sozinhas no primeiro start do backend (não
precisa rodar SQL manual).

---

## Passo 2 — Backend no Render (Docker) · grátis

1. Suba o repositório no GitHub (se ainda não estiver).
2. Em <https://render.com>: **New → Blueprint** → conecte o repositório.
   O Render lê o [`render.yaml`](../render.yaml) e cria o serviço `volley-manager-api`.
3. No serviço criado, abra **Environment** e preencha as variáveis `sync:false`:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a string `postgresql+asyncpg://...` do Passo 1.3 |
   | `SUPABASE_URL` | `https://XXXX.supabase.co` |
   | `SUPABASE_JWT_SECRET` | o **JWT Secret** do Passo 1.2 |
   | `CORS_ORIGINS` | a URL do seu site no Netlify, ex.: `https://volleymanager.netlify.app` |

   (As demais — `ENV=production`, `DEV_NO_AUTH=false`, `DEV_SEED=false` — já vêm do `render.yaml`.)
4. **Deploy**. Quando ficar verde, teste a saúde:
   `https://volley-manager-api.onrender.com/api/v1/health` → `{"status":"ok"}`.
   > Anote essa URL base — é o seu `VITE_API_URL`.
   > No plano grátis o serviço "dorme" após inatividade; o 1º acesso leva ~30s.

---

## Passo 3 — Netlify (variáveis do frontend)

No painel do site (Netlify) → **Site configuration → Environment variables**,
adicione:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | `https://volley-manager-api.onrender.com` |
| `VITE_WS_URL` | `wss://volley-manager-api.onrender.com` |
| `VITE_SUPABASE_URL` | `https://XXXX.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | a **anon key** do Passo 1.2 |

> Variáveis `VITE_*` entram no build. Após salvar, faça **Deploys → Trigger
> deploy → Clear cache and deploy site** para reconstruir com os novos valores.

---

## Passo 4 — Testar

1. Abra o site do Netlify. Agora aparece a **tela de login** (Supabase configurado).
2. **Criar conta** → entrar. No primeiro acesso o backend cria seu clube, elenco
   e carteira (3000 prata) automaticamente.
3. Vá em **Partida** e jogue. 🎉

---

## Resolução de problemas

| Sintoma | Causa provável / solução |
|---|---|
| "API offline" no painel | `VITE_API_URL` não setado no Netlify, ou backend dormindo (espere ~30s e recarregue), ou URL errada. |
| Erro de CORS no console | `CORS_ORIGINS` no Render precisa ser **exatamente** a origem do Netlify (com `https://`, sem barra final). |
| Login falha / 401 | `SUPABASE_JWT_SECRET` no backend tem que ser o mesmo do projeto Supabase; e `VITE_SUPABASE_*` no Netlify do mesmo projeto. |
| Backend não sobe (logs Render) | Confira `DATABASE_URL` no formato `postgresql+asyncpg://...` com a string do **Session pooler**. |
| Não recebe e-mail de confirmação | Desligue "Confirm email" no Supabase (Passo 1.4) ou confirme pelo link. |

> Dica: para evitar o "cold start" do plano grátis do Render, dá para usar um
> ping periódico (UptimeRobot) ou subir para um plano pago.
