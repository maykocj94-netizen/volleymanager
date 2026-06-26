"""Engine e sessão SQLAlchemy assíncronos."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# SQLite precisa de connect_args específico; Postgres usa pool_pre_ping.
_engine_kwargs: dict = {"echo": False}
if settings.is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_pre_ping"] = True
    if "asyncpg" in settings.database_url:
        # Supabase exige SSL; statement_cache_size=0 mantém compatibilidade com
        # o pooler (pgBouncer/Supavisor em modo transação).
        _engine_kwargs["connect_args"] = {"ssl": True, "statement_cache_size": 0}

engine = create_async_engine(settings.database_url, **_engine_kwargs)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base declarativa para todos os models ORM."""


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency do FastAPI: fornece uma sessão por request."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
