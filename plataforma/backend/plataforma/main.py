import hmac
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated

import boto3
import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from plataforma import nube
from plataforma.config import get_settings
from plataforma.db import Base, engine, get_db
from plataforma.esquemas import (
    Credenciales,
    LineaSalida,
    Login,
    OperacionSalida,
    TenantEdicion,
    TenantNuevo,
    TenantSalida,
    Token,
)
from plataforma.modelos import (
    EstadoOperacion,
    EstadoTenant,
    LineaLog,
    Operacion,
    Tenant,
    TipoOperacion,
)
from plataforma.planes import MOTORES, catalogo

settings = get_settings()


@asynccontextmanager
async def ciclo(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Plataforma Presencia", version="1.0.0", lifespan=ciclo)
bearer = HTTPBearer(auto_error=False)

Db = Annotated[Session, Depends(get_db)]

OCUPADO = {
    EstadoTenant.creando,
    EstadoTenant.suspendiendo,
    EstadoTenant.reanudando,
    EstadoTenant.eliminando,
}


def admin(credenciales: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if credenciales is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Inicia sesión")
    try:
        datos = jwt.decode(credenciales.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión vencida") from error
    return datos["sub"]


Admin = Annotated[str, Depends(admin)]


@app.get("/health", tags=["Sistema"])
def health() -> dict:
    return {"status": "ok", "version": settings.version}


@app.post("/auth/login", response_model=Token, tags=["Sesión"])
def login(datos: Login) -> Token:
    valido = hmac.compare_digest(datos.usuario, settings.usuario) & hmac.compare_digest(
        datos.password, settings.password
    )
    if not valido:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")
    expira = datetime.now(UTC) + timedelta(hours=settings.jwt_horas)
    token = jwt.encode({"sub": datos.usuario, "exp": expira}, settings.jwt_secret, "HS256")
    return Token(access_token=token)


@app.get("/planes", tags=["Catálogo"])
def planes() -> list[dict]:
    return list(catalogo().values())


@app.get("/opciones", tags=["Catálogo"])
def opciones(_: Admin) -> dict:
    return {
        "regiones": settings.regiones,
        "motores": [{"id": k, "nombre": v} for k, v in MOTORES.items()],
        "entornos": ["produccion", "pruebas"],
        "grafana_url": settings.grafana_url,
    }


def con_ultima(db: Session, tenant: Tenant) -> TenantSalida:
    salida = TenantSalida.model_validate(tenant)
    ultima = db.scalar(
        select(Operacion).where(Operacion.tenant_id == tenant.id).order_by(Operacion.id.desc())
    )
    salida.ultima_operacion = OperacionSalida.model_validate(ultima) if ultima else None
    return salida


def encolar(db: Session, tenant: Tenant, tipo: TipoOperacion, reintento_de=None) -> Operacion:
    op = Operacion(tenant_id=tenant.id, tipo=tipo, reintento_de=reintento_de)
    db.add(op)
    db.commit()
    return op


def buscar(db: Session, tenant_id: str) -> Tenant:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese tenant")
    return tenant


def libre(tenant: Tenant, db: Session) -> None:
    pendiente = db.scalar(
        select(func.count())
        .select_from(Operacion)
        .where(
            Operacion.tenant_id == tenant.id,
            Operacion.estado.in_([EstadoOperacion.pendiente, EstadoOperacion.ejecutando]),
        )
    )
    if tenant.estado in OCUPADO or pendiente:
        raise HTTPException(status.HTTP_409_CONFLICT, "El tenant tiene una operación en curso")


@app.get("/tenants", response_model=list[TenantSalida], tags=["Tenants"])
def listar(
    db: Db,
    _: Admin,
    nombre: str | None = None,
    estado: str | None = None,
    plan: str | None = None,
    entorno: str | None = None,
    incluir_eliminados: bool = False,
) -> list[TenantSalida]:
    consulta = select(Tenant).order_by(Tenant.creado_en.desc())
    if nombre:
        patron = f"%{nombre.strip()}%"
        consulta = consulta.where(Tenant.institucion.ilike(patron) | Tenant.id.ilike(patron))
    if estado:
        consulta = consulta.where(Tenant.estado == estado)
    elif not incluir_eliminados:
        consulta = consulta.where(Tenant.estado != EstadoTenant.eliminado)
    if plan:
        consulta = consulta.where(Tenant.plan == plan)
    if entorno:
        consulta = consulta.where(Tenant.entorno == entorno)
    return [con_ultima(db, t) for t in db.scalars(consulta)]


@app.post("/tenants", response_model=TenantSalida, status_code=201, tags=["Tenants"])
def crear(datos: TenantNuevo, db: Db, _: Admin) -> TenantSalida:
    if datos.region not in settings.regiones:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Región no habilitada")
    existente = db.get(Tenant, datos.id)
    if existente and existente.estado != EstadoTenant.eliminado:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un tenant con ese identificador")
    if existente:
        for campo, valor in datos.model_dump().items():
            setattr(existente, campo, valor)
        existente.estado, existente.salidas, existente.url = EstadoTenant.creando, {}, None
        tenant = existente
    else:
        tenant = Tenant(**datos.model_dump(), estado=EstadoTenant.creando)
        db.add(tenant)
    db.flush()
    encolar(db, tenant, TipoOperacion.crear)
    return con_ultima(db, tenant)


@app.get("/tenants/{tenant_id}", response_model=TenantSalida, tags=["Tenants"])
def detalle(tenant_id: str, db: Db, _: Admin) -> TenantSalida:
    return con_ultima(db, buscar(db, tenant_id))


@app.patch("/tenants/{tenant_id}", response_model=TenantSalida, tags=["Tenants"])
def editar(tenant_id: str, datos: TenantEdicion, db: Db, _: Admin) -> TenantSalida:
    tenant = buscar(db, tenant_id)
    tenant.institucion = datos.institucion
    db.commit()
    return con_ultima(db, tenant)


@app.post("/tenants/{tenant_id}/suspender", response_model=OperacionSalida, tags=["Ciclo de vida"])
def suspender(tenant_id: str, db: Db, _: Admin) -> Operacion:
    tenant = buscar(db, tenant_id)
    libre(tenant, db)
    if tenant.estado != EstadoTenant.activo:
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo se suspende un tenant activo")
    return encolar(db, tenant, TipoOperacion.suspender)


@app.post("/tenants/{tenant_id}/reanudar", response_model=OperacionSalida, tags=["Ciclo de vida"])
def reanudar(tenant_id: str, db: Db, _: Admin) -> Operacion:
    tenant = buscar(db, tenant_id)
    libre(tenant, db)
    if tenant.estado != EstadoTenant.suspendido:
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo se reanuda un tenant suspendido")
    return encolar(db, tenant, TipoOperacion.reanudar)


@app.get("/tenants/{tenant_id}/recursos", tags=["Ciclo de vida"])
def recursos(tenant_id: str, db: Db, _: Admin) -> list[dict]:
    tenant = buscar(db, tenant_id)
    return nube.recursos(tenant.region, tenant.id)


@app.delete("/tenants/{tenant_id}", response_model=OperacionSalida, tags=["Ciclo de vida"])
def eliminar(tenant_id: str, db: Db, _: Admin, confirmacion: str = Query()) -> Operacion:
    tenant = buscar(db, tenant_id)
    if confirmacion != tenant.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Escribe el identificador")
    libre(tenant, db)
    if tenant.estado == EstadoTenant.eliminado:
        raise HTTPException(status.HTTP_409_CONFLICT, "El tenant ya está eliminado")
    return encolar(db, tenant, TipoOperacion.eliminar)


@app.post("/tenants/{tenant_id}/reintentar", response_model=OperacionSalida, tags=["Ciclo de vida"])
def reintentar(tenant_id: str, db: Db, _: Admin) -> Operacion:
    tenant = buscar(db, tenant_id)
    libre(tenant, db)
    ultima = db.scalar(
        select(Operacion).where(Operacion.tenant_id == tenant.id).order_by(Operacion.id.desc())
    )
    if ultima is None or ultima.estado != EstadoOperacion.fallida:
        raise HTTPException(status.HTTP_409_CONFLICT, "La última operación no falló")
    return encolar(db, tenant, ultima.tipo, reintento_de=ultima.id)


@app.get("/tenants/{tenant_id}/credenciales", response_model=Credenciales, tags=["Tenants"])
def credenciales(tenant_id: str, db: Db, _: Admin) -> Credenciales:
    tenant = buscar(db, tenant_id)
    parametro = "/".join(["", "presencia", "tenants", tenant.id, "admin_password"])
    try:
        ssm = boto3.client("ssm", region_name=tenant.region)
        valor = ssm.get_parameter(Name=parametro, WithDecryption=True)["Parameter"]["Value"]
    except Exception as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El tenant aún no tiene credenciales") from error
    return Credenciales(url=tenant.url, registro=tenant.admin_registro, password=valor)


@app.get("/tenants/{tenant_id}/operaciones", response_model=list[OperacionSalida], tags=["Operaciones"])
def operaciones(tenant_id: str, db: Db, _: Admin) -> list[Operacion]:
    buscar(db, tenant_id)
    return list(
        db.scalars(select(Operacion).where(Operacion.tenant_id == tenant_id).order_by(Operacion.id.desc()))
    )


@app.get("/operaciones/{operacion_id}", response_model=OperacionSalida, tags=["Operaciones"])
def operacion(operacion_id: int, db: Db, _: Admin) -> Operacion:
    op = db.get(Operacion, operacion_id)
    if op is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa operación")
    return op


@app.get("/operaciones/{operacion_id}/log", response_model=list[LineaSalida], tags=["Operaciones"])
def log(operacion_id: int, db: Db, _: Admin, desde: int = 0) -> list[LineaLog]:
    return list(
        db.scalars(
            select(LineaLog)
            .where(LineaLog.operacion_id == operacion_id, LineaLog.id > desde)
            .order_by(LineaLog.id)
            .limit(10000)
        )
    )


@app.get("/eventos", response_model=list[OperacionSalida], tags=["Eventos"])
def eventos(db: Db, _: Admin) -> list[Operacion]:
    return list(db.scalars(select(Operacion).order_by(Operacion.id.desc()).limit(50)))


@app.get("/alertas", tags=["Eventos"])
def alertas(_: Admin) -> list[dict]:
    try:
        respuesta = httpx.get(f"{settings.grafana_interno}/api/prometheus/grafana/api/v1/alerts", timeout=5)
        datos = respuesta.json()["data"]["alerts"]
    except httpx.HTTPError, KeyError, ValueError:
        return []
    return [
        {
            "nombre": a["labels"].get("alertname"),
            "tenant": a["labels"].get("tenant"),
            "estado": a["state"],
            "desde": a.get("activeAt"),
            "resumen": a.get("annotations", {}).get("summary"),
        }
        for a in datos
        if a["state"] in ("Alerting", "Pending", "firing", "pending")
    ]
