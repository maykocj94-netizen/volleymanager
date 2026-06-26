"""Validação do JWT emitido pelo Supabase Auth."""

from dataclasses import dataclass

from jose import JWTError, jwt

from app.core.config import settings


@dataclass
class AuthUser:
    """Usuário autenticado extraído do token Supabase."""

    id: str
    email: str | None = None
    role: str = "authenticated"


class AuthError(Exception):
    """Falha de autenticação (token inválido/ausente)."""


def decode_token(token: str) -> AuthUser:
    """Valida o JWT do Supabase e devolve o usuário.

    O Supabase assina os access tokens com HS256 usando o JWT secret do projeto.
    """
    if not settings.supabase_jwt_secret:
        raise AuthError("SUPABASE_JWT_SECRET não configurado")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            # Não exigimos o audience: a segurança real é a assinatura (verificada
            # com o JWT secret do projeto). O `aud` do Supabase varia entre versões
            # e estava derrubando tokens válidos com 401.
            options={"verify_aud": False},
        )
    except JWTError as exc:  # noqa: BLE001
        raise AuthError(f"Token inválido: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise AuthError("Token sem 'sub'")

    return AuthUser(
        id=sub,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )
