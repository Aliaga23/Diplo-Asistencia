from fastapi import APIRouter, status

from app.core.deps import DB, CurrentUser
from app.schemas import ChangePasswordRequest, LoginRequest, TokenResponse, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenResponse, summary="Iniciar sesión")
def login(body: LoginRequest, db: DB) -> TokenResponse:
    """Valida número de registro y contraseña; devuelve un JWT con el rol del usuario."""
    user, token = auth_service.authenticate(db, body.registration_code, body.password)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut, summary="Usuario autenticado")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cambiar contraseña",
)
def change_password(body: ChangePasswordRequest, user: CurrentUser, db: DB) -> None:
    auth_service.change_password(db, user, body.current_password, body.new_password)
