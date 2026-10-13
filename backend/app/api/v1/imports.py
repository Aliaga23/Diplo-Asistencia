from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select

from app.core.deps import DB, AdminUser
from app.models import ImportBatch
from app.schemas import ImportBatchOut
from app.services import imports as svc

router = APIRouter(prefix="/imports", tags=["Importación Excel"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_BYTES = 5 * 1024 * 1024


async def _read(file: UploadFile) -> bytes:
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se aceptan archivos .xlsx")
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "El archivo supera los 5 MB")
    return content


@router.post("/students", response_model=ImportBatchOut, summary="Importar estudiantes")
async def import_students(
    db: DB,
    admin: AdminUser,
    course_id: Annotated[UUID, Query(description="Curso al que se inscriben")],
    file: Annotated[UploadFile, File(description="Excel con registro, nombre, email, programa")],
) -> ImportBatchOut:
    content = await _read(file)
    batch = svc.import_students(db, admin, course_id, file.filename or "archivo.xlsx", content)
    return ImportBatchOut.model_validate(batch)


@router.post("/sessions", response_model=ImportBatchOut, summary="Importar horarios y fechas")
async def import_sessions(
    db: DB,
    admin: AdminUser,
    course_id: Annotated[UUID, Query(description="Curso de las sesiones")],
    file: Annotated[UploadFile, File(description="Excel con fecha, hora_inicio, hora_fin, tema")],
) -> ImportBatchOut:
    content = await _read(file)
    batch = svc.import_sessions(db, admin, course_id, file.filename or "archivo.xlsx", content)
    return ImportBatchOut.model_validate(batch)


@router.get("", response_model=list[ImportBatchOut], summary="Historial de importaciones")
def list_imports(db: DB, _: AdminUser) -> list[ImportBatchOut]:
    batches = db.scalars(select(ImportBatch).order_by(ImportBatch.created_at.desc())).all()
    return [ImportBatchOut.model_validate(b) for b in batches]


@router.get("/templates/{kind}", summary="Descargar plantilla Excel")
def template(kind: Literal["students", "sessions"], _: AdminUser) -> Response:
    data = svc.template_students() if kind == "students" else svc.template_sessions()
    name = "plantilla_estudiantes.xlsx" if kind == "students" else "plantilla_horarios.xlsx"
    return Response(
        content=data,
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
