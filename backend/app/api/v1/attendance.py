from uuid import UUID

from fastapi import APIRouter, status

from app.core.config import get_settings
from app.core.deps import DB, AdminUser, CurrentStudent
from app.core.timeutils import now_local, today_local
from app.schemas import (
    AdminAttendanceUpsert,
    AttendanceMatrix,
    AttendanceRecordOut,
    MyAttendance,
)
from app.services import attendance as svc

router = APIRouter(tags=["Asistencia"])


@router.get(
    "/attendance/sessions/{session_id}",
    response_model=AttendanceMatrix,
    summary="Matriz de asistencia de una sesión",
)
def session_matrix(session_id: UUID, db: DB, _: AdminUser) -> AttendanceMatrix:
    return svc.session_matrix(db, session_id)


@router.put(
    "/attendance/sessions/{session_id}/students/{student_id}",
    response_model=AttendanceRecordOut,
    summary="Registrar o modificar asistencia (admin, cualquier fecha)",
)
def admin_set_attendance(
    session_id: UUID, student_id: UUID, body: AdminAttendanceUpsert, db: DB, admin: AdminUser
) -> AttendanceRecordOut:
    record = svc.admin_upsert(db, admin, session_id, student_id, body.status, body.note)
    return AttendanceRecordOut.model_validate(record)


@router.get(
    "/me/attendance",
    response_model=MyAttendance,
    summary="Mi asistencia (sesión de hoy, historial y estadísticas)",
)
def my_attendance(db: DB, student: CurrentStudent) -> MyAttendance:
    items, stats = svc.student_history(db, student)
    today = today_local()
    return MyAttendance(
        today=[i for i in items if i.session.session_date == today],
        history=items,
        stats=stats,
        server_now=now_local(),
        late_tolerance_minutes=get_settings().late_tolerance_minutes,
    )


@router.post(
    "/me/attendance/{session_id}",
    response_model=AttendanceRecordOut,
    summary="Registrar mi asistencia (solo el día de hoy)",
)
def mark_my_attendance(session_id: UUID, db: DB, student: CurrentStudent) -> AttendanceRecordOut:
    record = svc.student_self_mark(db, student, session_id)
    return AttendanceRecordOut.model_validate(record)


@router.delete(
    "/me/attendance/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Anular mi registro de hoy",
)
def cancel_my_attendance(session_id: UUID, db: DB, student: CurrentStudent) -> None:
    svc.student_cancel_mark(db, student, session_id)
