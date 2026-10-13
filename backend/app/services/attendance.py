"""Reglas de negocio de asistencia."""

from collections import Counter
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.timeutils import combine_local, now_local, today_local
from app.models import (
    AttendanceRecord,
    AttendanceSource,
    AttendanceStatus,
    ClassSession,
    Enrollment,
    Student,
    User,
)
from app.schemas import (
    AttendanceMatrix,
    AttendanceMatrixRow,
    AttendanceStats,
    SessionOut,
    StudentHistoryItem,
)


def is_closed(s: ClassSession) -> bool:
    """Una sesión está "dictada" cuando su fecha ya pasó o ya terminó su horario hoy."""
    now = now_local()
    return s.session_date < now.date() or (
        s.session_date == now.date() and s.end_time <= now.time()
    )


def closed_clause():
    """Equivalente SQL de `is_closed`, para agregaciones."""
    now = now_local()
    return or_(
        ClassSession.session_date < now.date(),
        and_(ClassSession.session_date == now.date(), ClassSession.end_time <= now.time()),
    )


def enrolled_count(db: Session, course_id: UUID) -> int:
    return (
        db.scalar(select(func.count(Enrollment.id)).where(Enrollment.course_id == course_id)) or 0
    )


def session_out(db: Session, s: ClassSession, enrolled: int | None = None) -> SessionOut:
    counts = Counter(r.status for r in s.attendance_records)
    enrolled_n = enrolled if enrolled is not None else enrolled_count(db, s.course_id)
    present = counts.get(AttendanceStatus.present, 0)
    late = counts.get(AttendanceStatus.late, 0)
    excused = counts.get(AttendanceStatus.excused, 0)
    absent = max(enrolled_n - present - late - excused, 0)
    return SessionOut(
        id=s.id,
        course_id=s.course_id,
        course_code=s.course.code,
        course_name=s.course.name,
        session_date=s.session_date,
        start_time=s.start_time,
        end_time=s.end_time,
        topic=s.topic,
        is_today=s.session_date == today_local(),
        present=present,
        late=late,
        absent=absent,
        excused=excused,
        enrolled=enrolled_n,
    )


def is_enrolled(db: Session, student_id: UUID, course_id: UUID) -> bool:
    return (
        db.scalar(
            select(Enrollment.id).where(
                Enrollment.student_id == student_id, Enrollment.course_id == course_id
            )
        )
        is not None
    )


def compute_self_status(session: ClassSession) -> AttendanceStatus:
    """Presente si marca antes de inicio + tolerancia; tarde después."""
    tolerance = timedelta(minutes=get_settings().late_tolerance_minutes)
    limit = combine_local(session.session_date, session.start_time) + tolerance
    return AttendanceStatus.present if now_local() <= limit else AttendanceStatus.late


def _get_record(db: Session, session_id: UUID, student_id: UUID) -> AttendanceRecord | None:
    return db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == student_id
        )
    )


def _today_session_for(db: Session, student: Student, session_id: UUID) -> ClassSession:
    """Valida que la sesión exista, sea de HOY y el estudiante esté inscrito."""
    session = db.get(ClassSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")
    if session.session_date != today_local():
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Solo puedes registrar o modificar tu asistencia del día de hoy",
        )
    if not is_enrolled(db, student.id, session.course_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No estás inscrito en este programa")
    return session


def student_self_mark(db: Session, student: Student, session_id: UUID) -> AttendanceRecord:
    """Registra la asistencia propia del día.

    - Es idempotente: si ya existe un registro, se devuelve sin cambios (nunca se degrada
      de "presente" a "tarde" por volver a pulsar el botón).
    - Un registro fijado por el administrador no puede ser modificado por el estudiante.
    """
    session = _today_session_for(db, student, session_id)
    record = _get_record(db, session.id, student.id)
    if record is not None:
        return record
    record = AttendanceRecord(
        session_id=session.id,
        student_id=student.id,
        status=compute_self_status(session),
        source=AttendanceSource.self,
        marked_at=now_local(),
        marked_by=student.user_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def student_cancel_mark(db: Session, student: Student, session_id: UUID) -> None:
    """Anula el registro propio del día (solo si lo hizo el estudiante)."""
    session = _today_session_for(db, student, session_id)
    record = _get_record(db, session.id, student.id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No tienes un registro para anular")
    if record.source != AttendanceSource.self:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Este registro fue confirmado por el administrador y no puede modificarse",
        )
    db.delete(record)
    db.commit()


def admin_upsert(
    db: Session,
    admin: User,
    session_id: UUID,
    student_id: UUID,
    new_status: AttendanceStatus,
    note: str | None,
) -> AttendanceRecord:
    session = db.get(ClassSession, session_id)
    student = db.get(Student, student_id)
    if session is None or student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión o estudiante no encontrado")
    if not is_enrolled(db, student.id, session.course_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El estudiante no está inscrito")
    record = _get_record(db, session.id, student.id)
    if record is None:
        record = AttendanceRecord(session_id=session.id, student_id=student.id)
        db.add(record)
    record.status = new_status
    record.source = AttendanceSource.admin
    record.marked_at = now_local()
    record.marked_by = admin.id
    record.note = note
    db.commit()
    db.refresh(record)
    return record


def session_matrix(db: Session, session_id: UUID) -> AttendanceMatrix:
    session = db.get(ClassSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")
    records = {r.student_id: r for r in session.attendance_records}
    students = db.scalars(
        select(Student)
        .join(Enrollment, Enrollment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .where(Enrollment.course_id == session.course_id)
        .order_by(User.full_name)
    ).all()
    rows = []
    for st in students:
        r = records.get(st.id)
        rows.append(
            AttendanceMatrixRow(
                student_id=st.id,
                registration_code=st.user.registration_code,
                full_name=st.user.full_name,
                email=st.user.email,
                status=r.status if r else AttendanceStatus.absent,
                source=r.source if r else None,
                marked_at=r.marked_at if r else None,
                note=r.note if r else None,
                recorded=r is not None,
            )
        )
    return AttendanceMatrix(session=session_out(db, session, len(students)), rows=rows)


def student_history(
    db: Session, student: Student, course_id: UUID | None = None
) -> tuple[list[StudentHistoryItem], AttendanceStats]:
    """Historial del estudiante; si se indica `course_id`, solo de ese programa."""
    course_ids = [e.course_id for e in student.enrollments]
    if course_id is not None:
        course_ids = [c for c in course_ids if c == course_id]
    empty = AttendanceStats(
        sessions_total=0, present=0, late=0, absent=0, excused=0, attendance_rate=0.0
    )
    if not course_ids:
        return [], empty
    today = today_local()
    sessions = db.scalars(
        select(ClassSession)
        .where(ClassSession.course_id.in_(course_ids))
        .order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc())
    ).all()
    records = {
        r.session_id: r
        for r in db.scalars(
            select(AttendanceRecord).where(AttendanceRecord.student_id == student.id)
        ).all()
    }
    enrolled_cache = {cid: enrolled_count(db, cid) for cid in course_ids}
    items: list[StudentHistoryItem] = []
    for s in sessions:
        r = records.get(s.id)
        items.append(
            StudentHistoryItem(
                session=session_out(db, s, enrolled_cache[s.course_id]),
                status=r.status if r else AttendanceStatus.absent,
                source=r.source if r else None,
                marked_at=r.marked_at if r else None,
                note=r.note if r else None,
                recorded=r is not None,
                editable=s.session_date == today,
            )
        )
    closed_ids = {s.id for s in sessions if is_closed(s)}
    counted = [i for i in items if i.session.id in closed_ids]
    c = Counter(i.status for i in counted)
    total = len(counted)
    attended = c.get(AttendanceStatus.present, 0) + c.get(AttendanceStatus.late, 0)
    stats = AttendanceStats(
        sessions_total=total,
        present=c.get(AttendanceStatus.present, 0),
        late=c.get(AttendanceStatus.late, 0),
        absent=c.get(AttendanceStatus.absent, 0),
        excused=c.get(AttendanceStatus.excused, 0),
        attendance_rate=round(attended / total * 100, 1) if total else 0.0,
    )
    return items, stats
