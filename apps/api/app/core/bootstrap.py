"""Bootstrap de desenvolvimento: cria tabelas e popula um jogo inicial.

Só roda quando ENV=development. Em produção use as migrations / db/schema.sql.
Idempotente: pode rodar sobre um banco existente para adicionar o que falta
(carteira do jogador, atletas de quadra) sem apagar o progresso.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.enums import Modality
from app.models.club import Club
from app.models.user_state import STARTING_GOLD, STARTING_SILVER, UserState
from app.repositories.athlete_repo import AthleteRepository
from app.services.athlete_service import AthleteService
from app.services.onboarding import ensure_squads


async def create_tables() -> None:
    """Cria todas as tabelas dos models (idempotente; dev SQLite ou prod Postgres)."""
    # Garante que todos os models estejam importados/registrados no metadata.
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def _ensure_columns_sync(conn) -> None:  # noqa: ANN001
    """Adiciona colunas novas dos models que faltem em tabelas já existentes.

    Funciona em SQLite (dev) e Postgres (prod): `create_all` não altera tabelas
    que já existem, então isto cobre a evolução do schema sem perder dados.
    """
    from sqlalchemy import JSON, inspect

    insp = inspect(conn)
    tables = set(insp.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in tables:
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            coltype = col.type.compile(dialect=conn.dialect)
            ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {coltype}'
            default = col.default
            if isinstance(col.type, JSON):
                ddl += " DEFAULT '{}'"
            elif default is not None and getattr(default, "arg", None) is not None \
                    and not callable(default.arg):
                v = default.arg
                # bool antes de int (True é instância de int em Python). Postgres
                # exige TRUE/FALSE; SQLite também aceita.
                if isinstance(v, bool):
                    ddl += f" DEFAULT {'TRUE' if v else 'FALSE'}"
                elif isinstance(v, (int, float)):
                    ddl += f" DEFAULT {v}"
                else:
                    ddl += f" DEFAULT '{v}'"
            conn.exec_driver_sql(ddl)


async def ensure_columns() -> None:
    """Migração leve de colunas faltantes (SQLite e Postgres)."""
    async with engine.begin() as conn:
        await conn.run_sync(_ensure_columns_sync)


async def _ensure_clubs(session: AsyncSession, owner: uuid.UUID) -> Club:
    """Garante o clube do jogador e o da CPU; devolve o clube do jogador."""
    user_club = (
        await session.execute(
            select(Club).where(Club.owner_id == owner, Club.is_cpu.is_(False)).limit(1)
        )
    ).scalars().first()
    if user_club:
        return user_club

    user_club = Club(
        id=uuid.uuid4(), owner_id=owner, name="OVER POINT", short_name="OVP",
        country="BRA", city="Vitória", modality=Modality.BEACH_M.value,
        reputation=62, fanbase=4200, is_cpu=False,
    )
    cpu_club = Club(
        id=uuid.uuid4(), owner_id=None, name="CPU Rivais", short_name="CPU",
        country="BRA", city="Saquarema", modality=Modality.BEACH_M.value,
        reputation=55, fanbase=3000, is_cpu=True, cpu_profile="balanced",
    )
    session.add_all([user_club, cpu_club])
    await session.flush()

    service = AthleteService(AthleteRepository(session))
    await service.generate(modality=Modality.BEACH_M, count=6, seed=2002, club_id=cpu_club.id)
    await service.generate(modality=Modality.BEACH_M, count=8, seed=3003, club_id=None)
    return user_club


# Seeds fixos para reprodutibilidade do elenco inicial em desenvolvimento.
_DEV_SQUAD_SEEDS = {
    Modality.BEACH_M: 1001,
    Modality.BEACH_F: 1101,
    Modality.INDOOR_M: 4004,
    Modality.INDOOR_F: 4104,
}


async def _ensure_user_state(session: AsyncSession, owner: uuid.UUID) -> None:
    """Garante a carteira do jogador (3000 prata / 0 ouro)."""
    state = await session.get(UserState, owner)
    if state is None:
        session.add(
            UserState(user_id=owner, silver=STARTING_SILVER, gold=STARTING_GOLD, streak=0, lineup={})
        )


async def seed_dev_game(session: AsyncSession) -> None:
    owner = uuid.UUID(settings.dev_user_id)
    user_club = await _ensure_clubs(session, owner)
    await ensure_squads(session, user_club, seeds=_DEV_SQUAD_SEEDS)
    await _ensure_user_state(session, owner)


async def init_app() -> None:
    """Inicialização no startup (dev e produção).

    - Cria as tabelas (idempotente) quando `auto_create_tables` está ligado —
      provisiona o schema no Postgres/Supabase no primeiro deploy.
    - Em desenvolvimento, popula o jogo inicial (clube + CPU + elenco).
    - Em produção, o onboarding de cada conta é feito sob demanda nos `/me`.
    """
    if settings.auto_create_tables:
        await create_tables()
        await ensure_columns()
    if settings.is_dev and settings.dev_seed:
        async with SessionLocal() as session:
            await seed_dev_game(session)
            await session.commit()


# Compatibilidade com chamadas antigas.
async def init_dev() -> None:
    await init_app()
