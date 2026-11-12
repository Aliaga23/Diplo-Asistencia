import time
from pathlib import Path

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.core.deps import AdminUser
from app.core.timeutils import now_local
from app.db.session import engine

router = APIRouter(prefix="/sistema", tags=["Sistema"])

ARCHIVO_VERSION = Path("/opt/presencia/VERSION")


def estado_base_datos() -> tuple[bool, float | None]:
    inicio = time.perf_counter()
    try:
        with engine.connect() as conexion:
            conexion.execute(text("SELECT 1"))
    except Exception:
        return False, None
    return True, round((time.perf_counter() - inicio) * 1000, 1)


def version_app() -> str:
    try:
        return ARCHIVO_VERSION.read_text(encoding="utf-8").strip()
    except OSError:
        return "desarrollo"


@router.get("/estado", summary="Estado de los servicios de la institución")
def estado(_: AdminUser) -> dict:
    bd_ok, latencia = estado_base_datos()
    return {
        "institucion": get_settings().app_name,
        "api": True,
        "base_datos": bd_ok,
        "latencia_bd_ms": latencia,
        "version": version_app(),
        "hora": now_local().isoformat(),
    }
