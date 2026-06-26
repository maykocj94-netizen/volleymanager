"""Validação do JWT emitido pelo Supabase Auth.

O Supabase atual assina os access tokens de usuário com chaves **assimétricas**
(ES256) — verificadas pelas chaves públicas do projeto (JWKS). Projetos/legados
ainda podem usar HS256 (segredo compartilhado). Suportamos os dois:

- alg HS256  -> verifica com `SUPABASE_JWT_SECRET`.
- alg ES256/RS256 -> busca a chave pública no JWKS do projeto e verifica.

Não exigimos o `audience`: a segurança é a assinatura. O `aud` do Supabase varia.
"""

import json
import urllib.request
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


_jwks_cache: dict | None = None


def _fetch_jwks() -> dict:
    url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    req = urllib.request.Request(url, headers={"User-Agent": "volley-manager-api"})
    with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
        return json.loads(resp.read().decode())


def _get_jwk(kid: str | None, *, refresh: bool = False) -> dict | None:
    """Chave pública do JWKS pelo `kid` (com cache; recarrega se rotacionou)."""
    global _jwks_cache
    if _jwks_cache is None or refresh:
        _jwks_cache = _fetch_jwks()
    for key in _jwks_cache.get("keys", []):
        if kid is None or key.get("kid") == kid:
            return key
    return None


_OPTIONS = {"verify_aud": False}


def decode_token(token: str) -> AuthUser:
    """Valida o JWT do Supabase (HS256 ou ES256/RS256) e devolve o usuário."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise AuthError(f"Token malformado: {exc}") from exc

    alg = header.get("alg", "HS256")
    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise AuthError("SUPABASE_JWT_SECRET não configurado")
            payload = jwt.decode(
                token, settings.supabase_jwt_secret, algorithms=["HS256"], options=_OPTIONS
            )
        else:
            kid = header.get("kid")
            key = _get_jwk(kid) or _get_jwk(kid, refresh=True)
            if key is None:
                raise AuthError("Chave pública do token não encontrada no JWKS do Supabase")
            payload = jwt.decode(token, key, algorithms=[alg], options=_OPTIONS)
    except AuthError:
        raise
    except JWTError as exc:
        raise AuthError(f"Token inválido: {exc}") from exc
    except Exception as exc:  # falha de rede ao buscar o JWKS  # noqa: BLE001
        raise AuthError(f"Falha ao validar token (JWKS): {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise AuthError("Token sem 'sub'")

    return AuthUser(
        id=sub,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )
