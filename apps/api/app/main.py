"""Ponto de entrada do FastAPI."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1 import api_router
from app.core.bootstrap import init_app
from app.core.config import settings
from app.models import Athlete, AthleteAttributes, Club  # noqa: F401 (registra metadata)
from app.ws import match_hub


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Cria as tabelas (dev SQLite ou prod Postgres) e, em dev, popula o jogo.
    await init_app()
    yield


app = FastAPI(
    title="Volley Manager API",
    version=__version__,
    description="Backend do jogo de gerenciamento de vôlei.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(match_hub.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"app": "Volley Manager API", "version": __version__, "docs": "/docs"}
