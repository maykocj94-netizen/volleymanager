# Volley Manager — API (FastAPI)

## Camadas

```
app/
├── api/v1/        # Controllers (routers): health, athletes, clubs, matches
├── services/      # Regra de negócio (orquestra repos + engines)
├── repositories/  # Acesso a dados (SQLAlchemy async)
├── models/        # ORM (Athlete, AthleteAttributes, Club)
├── schemas/       # DTOs Pydantic
├── engine/        # Domínio puro e testável: match_engine, generation
├── ws/            # WebSocket hubs (narração ao vivo)
├── core/          # config, database, security (JWT Supabase), deps
├── enums.py       # Enums de domínio (puros — sem dependências de I/O)
└── main.py        # App FastAPI + CORS + routers + WS
```

> A pasta `engine/` e `enums.py` não dependem do banco nem do FastAPI: são
> determinísticos e testáveis isoladamente (ver `tests/test_engine.py`).

## Rodando

```bash
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -e ".[dev]"
cp .env.example .env                              # preencha DATABASE_URL e SUPABASE_*
uvicorn app.main:app --reload --port 8000
```

- Docs interativas: http://localhost:8000/docs
- Healthcheck: http://localhost:8000/api/v1/health

## Testando a engine (sem banco)

```bash
pytest tests/test_engine.py -v
```

## Endpoints iniciais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/health` | status |
| POST | `/api/v1/matches/exhibition` | simula partida a partir de forças (determinístico por `seed`) |
| POST | `/api/v1/athletes/generate` | gera atletas proceduralmente *(auth)* |
| GET | `/api/v1/athletes/club/{id}` | elenco de um clube *(auth)* |
| POST | `/api/v1/clubs` | cria clube *(auth)* |
| GET | `/api/v1/clubs/mine` | meus clubes *(auth)* |
| WS | `/ws/match/exhibition` | narração ao vivo (envie o JSON da partida) |

## Banco de dados

Schema declarativo completo em [`../../db/schema.sql`](../../db/schema.sql).
Migrations versionadas (Alembic) entram na Fase 1 — ver [ROADMAP](../../docs/ROADMAP.md).
```bash
psql "$DATABASE_URL" -f ../../db/schema.sql
psql "$DATABASE_URL" -f ../../db/seed.sql
psql "$DATABASE_URL" -f ../../db/policies.sql
```
