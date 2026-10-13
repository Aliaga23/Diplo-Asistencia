from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models import User


def authenticate(db: Session, registration_code: str, password: str) -> tuple[User, str]:
    user = db.scalar(select(User).where(User.registration_code == registration_code.strip()))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La cuenta está desactivada")
    return user, create_access_token(user.id, user.role.value)


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta")
    if current == new:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La nueva contraseña debe ser distinta")
    user.password_hash = hash_password(new)
    user.must_change_password = False
    db.commit()
