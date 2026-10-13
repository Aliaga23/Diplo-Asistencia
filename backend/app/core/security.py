from datetime import timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.timeutils import now_local

_hasher = PasswordHash.recommended()


def hash_password(raw: str) -> str:
    return _hasher.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _hasher.verify(raw, hashed)
    except Exception:
        return False


def create_access_token(user_id: UUID, role: str) -> str:
    s = get_settings()
    exp = now_local() + timedelta(minutes=s.jwt_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": exp}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
