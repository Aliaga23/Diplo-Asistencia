from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.timeutils import now_local

TAGS = [
    {"name": "Autenticación", "description": "Login con JWT y gestión de contraseña."},
    {
        "name": "Programas y sesiones",
        "description": "Programas académicos y sus horarios/fechas de clase.",
    },
    {"name": "Estudiantes", "description": "Gestión de estudiantes (solo administrador)."},
    {"name": "Asistencia", "description": "Registro y modificación de asistencia."},
    {"name": "Importación Excel", "description": "Carga masiva de estudiantes y horarios."},
    {"name": "Panel y reportes", "description": "Indicadores y exportación."},
]


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=f"{settings.app_name} — API",
        version="1.0.0",
        description=(
            "API REST del Sistema de Registro de Asistencia. "
            "Roles: **admin** (gestiona todo) y **student** (registra su asistencia del día)."
        ),
        openapi_tags=TAGS,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(IntegrityError)
    async def integrity_handler(_: Request, exc: IntegrityError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "El registro entra en conflicto con datos existentes"},
        )

    @app.get("/health", tags=["Sistema"], summary="Estado del servicio")
    def health() -> dict:
        return {"status": "ok", "time": now_local().isoformat(), "timezone": settings.timezone}

    app.include_router(api_router)
    return app


app = create_app()
