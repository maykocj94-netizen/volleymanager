"""Configuração da aplicação (carregada de variáveis de ambiente / .env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"

    # DB: em dev usamos SQLite (zero config). Em produção, defina DATABASE_URL
    # apontando para o Postgres/Supabase (driver asyncpg).
    database_url: str = "sqlite+aiosqlite:///./volley_dev.db"

    # Auth: em dev, sem login (usuário fixo). Em produção, valida o JWT Supabase.
    dev_no_auth: bool = True
    dev_user_id: str = "00000000-0000-0000-0000-000000000001"

    # Seed automático do jogo (cria seu time + CPU com atletas na 1ª execução).
    dev_seed: bool = True

    # Cria as tabelas no startup (idempotente). Vale também em produção para
    # provisionar o schema no Postgres/Supabase no primeiro deploy.
    auto_create_tables: bool = True

    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""

    # Central de contas (admin). Login do dono no frontend: usuário/senha abaixo.
    admin_username: str = "dono"
    admin_password: str = "dono"

    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.env == "development"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
