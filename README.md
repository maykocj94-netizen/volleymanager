# 🏐 Volley Manager

Jogo de **gerenciamento esportivo** focado em **vôlei de praia e de quadra**, inspirado em Football Manager, Top Eleven e OSM. Você é o treinador/gestor: monta equipes, contrata e treina atletas, disputa campeonatos contra a CPU e contra outros jogadores online.

Entregue como **PWA** instalável em Android, iPhone, tablet e desktop.

---

## ✨ Funcionalidades (visão)

- 4 modalidades: praia masculino/feminino e quadra masculino/feminino
- Atletas com 13 atributos, potencial, evolução por idade/treino/partidas, lesões
- Entrosamento (química) — em destaque no vôlei de praia
- Engine de partida **determinística** (cálculo matemático, sem física) com narração textual ao vivo
- Treinos por fundamento, finanças, centro de treinamento evolutivo
- Competições: ligas, torneios (mata-mata / grupos / pontos corridos), temporadas
- Mercado de transferências (compra, venda, empréstimo)
- Geração procedural de atletas a cada temporada
- Multiplayer online (convite → sala → escalação → tática → partida ao vivo via WebSocket)
- Rankings (global/nacional/estadual), seleções nacionais, painel admin

> Estado atual: **Fase 0 — fundação jogável**. Veja [docs/ROADMAP.md](docs/ROADMAP.md).

---

## ▶ Jogar agora (sem configurar nada)

Em desenvolvimento o jogo roda **sem Supabase e sem Postgres**: usa SQLite, cria as
tabelas sozinho e já popula seu time **OVER POINT**, rivais da **CPU** e o mercado.

1. Abra o projeto no VS Code → aba **Executar e Depurar** (`Ctrl+Shift+D`).
2. Selecione **🎮 Jogar (API + Web)** e pressione **F5**.
3. O navegador abre em `http://localhost:5173`. Vá em **Partida → Iniciar partida ao vivo**.

Guia completo: [docs/COMO_JOGAR.md](docs/COMO_JOGAR.md).

> Pré-requisito único: rode `npm install` na raiz e crie o venv da API
> (`cd apps/api && python -m venv .venv && .venv\Scripts\activate && pip install -e .`).
> Depois disso, é só apertar ▶.

---

## 🧱 Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | React · TypeScript · Vite · TailwindCSS · Shadcn UI · React Query · React Router · Zustand · PWA (vite-plugin-pwa) |
| **Backend** | FastAPI · Python 3.12 · SQLAlchemy (async) · Pydantic · Alembic · WebSockets |
| **Banco** | PostgreSQL (via Supabase) |
| **Auth** | Supabase Auth (JWT validado no backend) |
| **Deploy** | Web → Vercel/Netlify · API → Railway · DB/Auth → Supabase |

---

## 📁 Estrutura do monorepo

```
volley-manager/
├── apps/
│   ├── web/        # Frontend PWA (React + Vite)
│   └── api/        # Backend FastAPI
├── packages/
│   └── shared/     # Tipos e enums TS compartilhados
├── db/             # schema.sql, seed.sql, policies.sql (RLS)
└── docs/           # ARCHITECTURE · ROADMAP · DATABASE
```

---

## 🚀 Começando

### Pré-requisitos
- Node.js ≥ 20, Python ≥ 3.12
- Uma instância PostgreSQL (recomendado: projeto no [Supabase](https://supabase.com))

### 1) Instalar dependências do frontend
```bash
npm install            # instala workspaces (apps/web, packages/*)
```

### 2) Banco de dados
Aplique os arquivos em `db/` na sua instância Postgres/Supabase:
```bash
# via psql (exemplo)
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
psql "$DATABASE_URL" -f db/policies.sql
```

### 3) Backend
```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
cp .env.example .env        # preencha DATABASE_URL e SUPABASE_*
uvicorn app.main:app --reload --port 8000
```

### 4) Frontend
```bash
cd apps/web
cp .env.example .env        # preencha VITE_SUPABASE_* e VITE_API_URL
npm run dev
```

---

## 📚 Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Banco de dados](docs/DATABASE.md)

## 📄 Licença

Projeto privado — todos os direitos reservados.
