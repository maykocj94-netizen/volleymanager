"""Agrega os routers da API v1."""

from fastapi import APIRouter

from app.api.v1 import admin, athletes, clubs, health, market, matches, me

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(athletes.router)
api_router.include_router(clubs.router)
api_router.include_router(matches.router)
api_router.include_router(me.router)
api_router.include_router(market.router)
api_router.include_router(admin.router)
