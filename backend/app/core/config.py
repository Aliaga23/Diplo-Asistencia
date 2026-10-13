from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la aplicación leída desde variables de entorno / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Sistema de Asistencia"
    environment: str = "development"
    database_url: str = "sqlite:///./asistencia.db"
    jwt_secret: str = Field(default="cambiar-este-secreto-en-produccion-0123456789", min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12
    cors_origins: list[str] = ["http://localhost:3000"]
    timezone: str = "America/La_Paz"
    late_tolerance_minutes: int = 15
    # Contraseña común asignada a todas las cuentas nuevas (admin y estudiantes).
    default_password: str = "admin1234!"
    admin_registration: str = "218166141"
    admin_email: str = "admin@presencia.edu.bo"
    admin_name: str = "Administrador del sistema"


@lru_cache
def get_settings() -> Settings:
    return Settings()
