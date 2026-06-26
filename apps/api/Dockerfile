# Volley Manager — API (FastAPI) para deploy (Render/Railway/Fly/qualquer Docker)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    ENV=production

WORKDIR /app

# Instala dependências + o pacote (com o extra 'postgres' = driver asyncpg).
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install ".[postgres]"

EXPOSE 8000

# Render/Railway injetam $PORT; cai para 8000 quando rodado localmente.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
