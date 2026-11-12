import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

TEXTO_SEGURO = re.compile(r"^[\w áéíóúÁÉÍÓÚñÑüÜ.,()&-]+$")


def _texto(valor: str) -> str:
    valor = " ".join(valor.split())
    if not TEXTO_SEGURO.fullmatch(valor):
        raise ValueError("Usa solo letras, números, espacios y . , ( ) & -")
    return valor


class Login(BaseModel):
    usuario: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TenantNuevo(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{2,19}$")
    institucion: str = Field(min_length=3, max_length=120)
    correo: EmailStr
    region: str = "us-east-1"
    entorno: Literal["produccion", "pruebas"] = "produccion"
    plan: Literal["basico", "estandar", "avanzado"]
    motor: Literal["terraform", "pulumi"]
    admin_registro: str = Field(pattern=r"^\d{6,12}$")
    admin_nombre: str = Field(min_length=3, max_length=120)
    datos_demo: bool = False

    _institucion = field_validator("institucion", "admin_nombre")(_texto)


class TenantEdicion(BaseModel):
    institucion: str = Field(min_length=3, max_length=120)

    _institucion = field_validator("institucion")(_texto)


class OperacionSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: str
    tipo: str
    estado: str
    error: str | None
    versiones: dict
    reintento_de: int | None
    creada_en: datetime
    iniciada_en: datetime | None
    terminada_en: datetime | None


class TenantSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    institucion: str
    correo: str
    region: str
    entorno: str
    plan: str
    motor: str
    admin_registro: str
    admin_nombre: str
    datos_demo: bool
    estado: str
    url: str | None
    salidas: dict
    creado_en: datetime
    actualizado_en: datetime
    ultima_operacion: OperacionSalida | None = None


class LineaSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    texto: str
    creada_en: datetime


class Credenciales(BaseModel):
    url: str | None
    registro: str
    password: str
