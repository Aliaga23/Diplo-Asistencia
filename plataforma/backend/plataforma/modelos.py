import enum
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from plataforma.db import Base


def ahora() -> datetime:
    return datetime.now(UTC)


class EstadoTenant(enum.StrEnum):
    creando = "creando"
    activo = "activo"
    suspendiendo = "suspendiendo"
    suspendido = "suspendido"
    reanudando = "reanudando"
    eliminando = "eliminando"
    eliminado = "eliminado"
    error = "error"


class TipoOperacion(enum.StrEnum):
    crear = "crear"
    suspender = "suspender"
    reanudar = "reanudar"
    eliminar = "eliminar"


class EstadoOperacion(enum.StrEnum):
    pendiente = "pendiente"
    ejecutando = "ejecutando"
    exitosa = "exitosa"
    fallida = "fallida"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    institucion: Mapped[str] = mapped_column(String(120))
    correo: Mapped[str] = mapped_column(String(160))
    region: Mapped[str] = mapped_column(String(30))
    entorno: Mapped[str] = mapped_column(String(20))
    plan: Mapped[str] = mapped_column(String(20))
    motor: Mapped[str] = mapped_column(String(20))
    admin_registro: Mapped[str] = mapped_column(String(20))
    admin_nombre: Mapped[str] = mapped_column(String(120))
    datos_demo: Mapped[bool] = mapped_column(default=False)
    admin_cidrs: Mapped[list] = mapped_column(JSON, default=list)
    estado: Mapped[EstadoTenant] = mapped_column(
        Enum(EstadoTenant, native_enum=False, length=20), default=EstadoTenant.creando
    )
    url: Mapped[str | None] = mapped_column(String(200))
    salidas: Mapped[dict] = mapped_column(JSON, default=dict)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, onupdate=ahora)

    operaciones: Mapped[list["Operacion"]] = relationship(
        back_populates="tenant", order_by="Operacion.id.desc()"
    )


class Operacion(Base):
    __tablename__ = "operaciones"
    __table_args__ = (Index("ix_operaciones_estado", "estado"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"))
    tipo: Mapped[TipoOperacion] = mapped_column(Enum(TipoOperacion, native_enum=False, length=20))
    estado: Mapped[EstadoOperacion] = mapped_column(
        Enum(EstadoOperacion, native_enum=False, length=20), default=EstadoOperacion.pendiente
    )
    reintento_de: Mapped[int | None] = mapped_column(ForeignKey("operaciones.id"))
    error: Mapped[str | None] = mapped_column(Text)
    versiones: Mapped[dict] = mapped_column(JSON, default=dict)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    iniciada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terminada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tenant: Mapped[Tenant] = relationship(back_populates="operaciones")


class LineaLog(Base):
    __tablename__ = "operacion_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    operacion_id: Mapped[int] = mapped_column(ForeignKey("operaciones.id"), index=True)
    texto: Mapped[str] = mapped_column(Text)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
