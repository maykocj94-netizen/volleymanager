# 🎮 Como jogar (modo desenvolvimento)

O jogo roda **localmente sem precisar de Supabase nem Postgres**: em dev usa
SQLite, cria as tabelas sozinho e já popula um jogo inicial (seu time
**OVER POINT**, rivais da **CPU** e atletas no mercado).

## Opção A — Um clique no VS Code (recomendado)

1. Abra a pasta do projeto no VS Code.
2. Aba **Executar e Depurar** (`Ctrl+Shift+D`).
3. No seletor no topo, escolha **🎮 Jogar Volley Manager** e clique em ▶ (ou `F5`).
   - Sobe a **API** (FastAPI, porta 8000) e o **Web** (Vite, 5173).
   - **Abre o navegador automaticamente** em http://localhost:5173.
   - Se já houver uma sessão rodando, pare-a antes (botão ■ vermelho) para
     liberar a porta 8000.
4. Comece a jogar:
   - **Painel**: visão do seu clube (atletas, força média, reputação).
   - **Elenco**: veja atributos dos atletas e clique em *Contratar revelação*.
   - **Partida**: deixe **"Usar meu elenco"** marcado, escolha a tática e clique
     em **Iniciar partida ao vivo** — a narração aparece rally a rally.

> Coloque *breakpoints* no Python (ex.: `app/engine/match_engine.py`) — como a
> API roda sob o depurador, eles serão atingidos.

## Opção B — Terminal (um comando)

Com as dependências já instaladas, na raiz do projeto:

```bash
npm run play
```

Esse comando sobe API + Web e abre o navegador. Para parar, `Ctrl+C`.

### Ou manualmente (dois terminais)

```bash
# Terminal 1 — API
cd apps/api
.venv\Scripts\activate            # Windows (venv já criado)
uvicorn app.main:app --reload --port 8000      # http://localhost:8000/docs

# Terminal 2 — Web
npm run dev:web                                 # http://localhost:5173
```

## Resetar o jogo

Apague o banco local e ele será recriado/populado no próximo start:

```bash
del apps\api\volley_dev.db        # Windows
```

## Configurar Supabase/Postgres (produção)

1. `apps/api/.env`: defina `ENV=production`, `DATABASE_URL` (Postgres/asyncpg),
   `SUPABASE_JWT_SECRET`, e `DEV_NO_AUTH=false`.
2. Aplique `db/schema.sql`, `db/seed.sql`, `db/policies.sql` no Postgres.
3. `apps/web/.env`: defina `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e
   `VITE_API_URL`.

> Em produção a autenticação volta a ser obrigatória (JWT do Supabase) e a
> simulação continua no servidor (determinística por seed = anti-trapaça).
