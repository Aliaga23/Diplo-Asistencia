from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Student, User, UserRole

bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado")
    try:
        payload = decode_access_token(creds.credentials)
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inactivo o inexistente")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Se requiere rol de administrador")
    return user


def require_student(user: CurrentUser) -> Student:
    if user.role != UserRole.student or user.student is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Se requiere rol de estudiante")
    return user.student


AdminUser = Annotated[User, Depends(require_admin)]
CurrentStudent = Annotated[Student, Depends(require_student)]
