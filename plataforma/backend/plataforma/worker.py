"""Ejecuta en segundo plano las operaciones encoladas por la API.

Toma operaciones pendientes con FOR UPDATE SKIP LOCKED, como máximo una activa por tenant, y las
corre en hilos para que dos tenants puedan crearse a la vez.
"""

import hashlib
import logging
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from sqlalchemy import exists, select, update
from sqlalchemy.orm import aliased

from plataforma import nube
from plataforma.config import get_settings
from plataforma.db import Base, SessionLocal, engine
from plataforma.errores import ErrorOperacion, explicar
from plataforma.escaneo import escanear
from plataforma.modelos import (
    EstadoOperacion,
    EstadoTenant,
    LineaLog,
    Operacion,
    Tenant,
    TipoOperacion,
)
from plataforma.motores import MOTORES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
registro = logging.getLogger("worker")

HILOS = 4


class Bitacora:
    """Guarda las líneas del log en la base cada medio segundo."""

    def __init__(self, operacion_id: int):
        self.operacion_id = operacion_id
        self.pendientes: list[str] = []
        self.candado = threading.Lock()
        self.ultimo = time.monotonic()

    def __call__(self, texto: str) -> None:
        with self.candado:
            self.pendientes.append(texto)
        if time.monotonic() - self.ultimo > 0.5:
            self.guardar()

    def guardar(self) -> None:
        with self.candado:
            lineas, self.pendientes = self.pendientes, []
            self.ultimo = time.monotonic()
        if lineas:
            with SessionLocal() as db:
                db.add_all(LineaLog(operacion_id=self.operacion_id, texto=t) for t in lineas)
                db.commit()


def huella_plantillas() -> str:
    s = get_settings()
    h = hashlib.sha256()
    carpetas = [s.tenant_dir, s.repo_dir / "infraestructure" / "modules"]
    archivos = [s.planes_path]
    for carpeta in carpetas:
        archivos += [
            p
            for p in carpeta.rglob("*")
            if p.is_file() and ".venv" not in p.parts and ".terraform" not in p.parts
        ]
    for archivo in sorted(archivos):
        h.update(str(archivo.relative_to(s.repo_dir)).encode())
        h.update(archivo.read_bytes())
    return h.hexdigest()[:12]


def variables(tenant: Tenant, ami_id: str) -> dict:
    return {
        "tenant": tenant.id,
        "institucion": tenant.institucion,
        "plan": tenant.plan,
        "entorno": tenant.entorno,
        "region": tenant.region,
        "cuenta_aws": get_settings().cuenta_aws,
        "admin_cidrs": tenant.admin_cidrs,
        "admin_registro": tenant.admin_registro,
        "admin_nombre": tenant.admin_nombre,
        "admin_correo": tenant.correo,
        "datos_demo": tenant.datos_demo,
        "ami_id": ami_id,
    }


def crear(tenant: Tenant, op: Operacion, log: Bitacora) -> None:
    motor_cls = MOTORES[tenant.motor]
    log(f"Tenant {tenant.id} ({tenant.institucion}) · plan {tenant.plan} · motor {tenant.motor}")

    imagen = nube.ultima_imagen(tenant.region)
    log(f"Imagen: {imagen['id']} ({imagen['nombre']}, app {imagen['version']})")
    tenant.admin_cidrs = [f"{nube.mi_ip()}/32"]
    log(f"Métricas abiertas solo para la IP de la plataforma: {tenant.admin_cidrs[0]}")

    datos = variables(tenant, imagen["id"])
    motor = motor_cls(tenant.id, datos, log)
    op.versiones = {
        "plataforma": get_settings().version,
        "app": imagen["version"],
        "ami": imagen["id"],
        "motor": tenant.motor,
        "version_motor": motor.version(),
        "plantillas": huella_plantillas(),
    }
    log(f"Versiones: {op.versiones}")

    escanear(datos, log)

    log(f"== Aprovisionando con {tenant.motor} ==")
    salidas = motor.aplicar()
    tenant.salidas = salidas
    tenant.url = salidas["url"]
    log(f"Servidores: {', '.join(salidas['instancias'])}")

    nube.esperar_app(tenant.url, log, minutos=35 if salidas.get("rds") else 20)
    log(f"Listo. Administrador del tenant: registro {tenant.admin_registro}")


def eliminar(tenant: Tenant, op: Operacion, log: Bitacora) -> None:
    datos = variables(tenant, tenant.salidas.get("ami", ""))
    motor = MOTORES[tenant.motor](tenant.id, datos, log)
    op.versiones = {"motor": tenant.motor, "version_motor": motor.version()}
    log(f"== Eliminando {tenant.id} con {tenant.motor} ==")
    motor.destruir()
    tenant.url = None
    tenant.salidas = {}
    log("Recursos eliminados y estado del motor borrado.")


def suspender(tenant: Tenant, op: Operacion, log: Bitacora) -> None:
    nube.suspender(tenant.region, tenant.salidas, log)


def reanudar(tenant: Tenant, op: Operacion, log: Bitacora) -> None:
    nube.reanudar(tenant.region, tenant.salidas, log)
    nube.esperar_app(tenant.url, log, minutos=10)


ACCIONES = {
    TipoOperacion.crear: (crear, EstadoTenant.creando, EstadoTenant.activo),
    TipoOperacion.suspender: (suspender, EstadoTenant.suspendiendo, EstadoTenant.suspendido),
    TipoOperacion.reanudar: (reanudar, EstadoTenant.reanudando, EstadoTenant.activo),
    TipoOperacion.eliminar: (eliminar, EstadoTenant.eliminando, EstadoTenant.eliminado),
}


def ejecutar_operacion(operacion_id: int) -> None:
    log = Bitacora(operacion_id)
    with SessionLocal() as db:
        op = db.get(Operacion, operacion_id)
        tenant = op.tenant
        accion, durante, despues = ACCIONES[op.tipo]
        tenant.estado = durante
        db.commit()
        try:
            accion(tenant, op, log)
            op.estado = EstadoOperacion.exitosa
            tenant.estado = despues
        except ErrorOperacion as error:
            log(f"ERROR: {error}")
            op.estado, op.error = EstadoOperacion.fallida, str(error)
            tenant.estado = EstadoTenant.error
        except Exception as error:
            detalle = traceback.format_exc()
            for linea in detalle.splitlines():
                log(linea)
            mensaje = explicar(detalle) or f"Error inesperado: {error}"
            log(f"ERROR: {mensaje}")
            op.estado, op.error = EstadoOperacion.fallida, mensaje
            tenant.estado = EstadoTenant.error
        op.terminada_en = datetime.now(UTC)
        log.guardar()
        db.commit()
        registro.info("operación %s %s: %s", op.id, op.tipo, op.estado)


def tomar_operacion() -> int | None:
    otra = aliased(Operacion)
    with SessionLocal() as db:
        op = db.scalar(
            select(Operacion)
            .where(Operacion.estado == EstadoOperacion.pendiente)
            .where(
                ~exists().where(
                    otra.tenant_id == Operacion.tenant_id,
                    otra.estado == EstadoOperacion.ejecutando,
                )
            )
            .order_by(Operacion.id)
            .limit(1)
            .with_for_update(skip_locked=True, of=Operacion)
        )
        if op is None:
            return None
        op.estado = EstadoOperacion.ejecutando
        op.iniciada_en = datetime.now(UTC)
        db.commit()
        return op.id


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.execute(
            update(Operacion)
            .where(Operacion.estado == EstadoOperacion.ejecutando)
            .values(
                estado=EstadoOperacion.fallida,
                error="La plataforma se reinició durante la operación. Reintenta.",
                terminada_en=datetime.now(UTC),
            )
        )
        db.commit()
    registro.info("worker listo")
    with ThreadPoolExecutor(max_workers=HILOS) as hilos:
        while True:
            operacion_id = tomar_operacion()
            if operacion_id is None:
                time.sleep(2)
                continue
            registro.info("tomando operación %s", operacion_id)
            hilos.submit(ejecutar_operacion, operacion_id)


if __name__ == "__main__":
    main()
