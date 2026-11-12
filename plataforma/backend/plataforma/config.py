from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PLATAFORMA_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://plataforma:plataforma@db:5432/plataforma"
    usuario: str = "admin"
    password: str = Field(min_length=8)
    jwt_secret: str = Field(min_length=32)
    jwt_horas: int = 12

    cuenta_aws: str
    regiones: list[str] = ["us-east-1"]
    repo_dir: Path = Path("/app/repo")
    datos_dir: Path = Path("/datos")
    version: str = "dev"
    grafana_url: str = "/grafana/d/salud-tenants"
    grafana_interno: str = "http://grafana:3000/grafana"

    @property
    def tenant_dir(self) -> Path:
        return self.repo_dir / "infraestructure" / "tenant"

    @property
    def planes_path(self) -> Path:
        return self.repo_dir / "plataforma" / "planes.yaml"


@lru_cache
def get_settings() -> Settings:
    return Settings()
