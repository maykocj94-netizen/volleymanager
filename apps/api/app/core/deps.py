"""Dependencies compartilhadas do FastAPI."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.security import AuthError, AuthUser, decode_token

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    """Resolve o usuário autenticado.

    Em desenvolvimento (`DEV_NO_AUTH=true`) devolve um usuário fixo, para que o
    jogo seja jogável sem configurar Supabase. Em produção valida o JWT.
    """
    if settings.dev_no_auth:
        return AuthUser(id=settings.dev_user_id, email="dev@volley.local", role="dev")

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais ausentes",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


async def require_admin(
    x_admin_token: Annotated[str | None, Header()] = None,
) -> bool:
    """Protege a central de contas. O frontend envia o header X-Admin-Token
    com a senha do dono (login dono/dono)."""
    if not x_admin_token or x_admin_token != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao dono."
        )
    return True


AdminAuth = Annotated[bool, Depends(require_admin)]
