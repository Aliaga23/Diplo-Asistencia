from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.deps import DB, AdminUser
from app.core.security import hash_password
from app.core.timeutils import now_local, today_local
from app.models import (
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Course,
    Enrollment,
    Student,
    User,
    UserRole,
)
from app.schemas import (
    MyAttendance,
    StudentCreate,
    StudentOut,
    StudentSummary,
    StudentUpdate,
)
from app.services.attendance import closed_clause, student_history

router = APIRouter(prefix="/students", tags=["Estudiantes"])


def _student_out(st: Student) -> StudentOut:
    return StudentOut(
        id=st.id,
        registration_code=st.user.registration_code,
        career=st.career,
        user_id=st.user_id,
        email=st.user.email,
        full_name=st.user.full_name,
        is_active=st.user.is_active,
    )


def summarize(
    db: Session, students: list[Student], course_id: UUID | None = None
) -> list[StudentSummary]:
    """Resumen de asistencia sobre las sesiones ya dictadas (de un programa o de todos)."""
    sessions_per_course = dict(
        db.execute(
            select(ClassSession.course_id, func.count(ClassSession.id))
            .where(closed_clause())
            .group_by(ClassSession.course_id)
        ).all()
    )
    counts: dict[UUID, dict[AttendanceStatus, int]] = defaultdict(lambda: defaultdict(int))
    records = (
        select(AttendanceRecord.student_id, AttendanceRecord.status, func.count())
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .where(closed_clause())
        .group_by(AttendanceRecord.student_id, AttendanceRecord.status)
    )
    if course_id is not None:
        records = records.where(ClassSession.course_id == course_id)
    for student_id, st_status, n in db.execute(records).all():
        counts[student_id][st_status] = n

    out: list[StudentSummary] = []
    for st in students:
        total = sum(
            sessions_per_course.get(e.course_id, 0)
            for e in st.enrollments
            if course_id is None or e.course_id == course_id
        )
        c = counts[st.id]
        present = c[AttendanceStatus.present]
        late = c[AttendanceStatus.late]
        excused = c[AttendanceStatus.excused]
        absent = max(total - present - late - excused, 0)
        out.append(
            StudentSummary(
                **_student_out(st).model_dump(),
                sessions_total=total,
                present=present,
                late=late,
                absent=absent,
                excused=excused,
                attendance_rate=round((present + late) / total * 100, 1) if total else 0.0,
            )
        )
    return out


@router.get("", response_model=list[StudentSummary], summary="Listar estudiantes con resumen")
def list_students(
    db: DB, _: AdminUser, q: str | None = None, course_id: UUID | None = None
) -> list[StudentSummary]:
    stmt = (
        select(Student)
        .join(User, User.id == Student.user_id)
        .options(selectinload(Student.user), selectinload(Student.enrollments))
        .order_by(User.full_name)
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(like),
                User.email.ilike(like),
                User.registration_code.ilike(like),
            )
        )
    if course_id:
        stmt = stmt.join(Enrollment, Enrollment.student_id == Student.id).where(
            Enrollment.course_id == course_id
        )
    return summarize(db, list(db.scalars(stmt).unique().all()), course_id)


@router.post(
    "",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar estudiante o inscribir uno existente en un programa",
)
def create_student(body: StudentCreate, db: DB, _: AdminUser) -> StudentOut:
    """Si el registro ya existe como estudiante, solo lo inscribe en el programa indicado."""
    code = body.registration_code.strip()
    email = body.email.lower() if body.email else None
    course = None
    if body.course_id:
        course = db.get(Course, body.course_id)
        if course is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Programa no encontrado")

    user = db.scalar(select(User).where(User.registration_code == code))
    if user is not None:
        if user.role != UserRole.student or user.student is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "El registro pertenece a un usuario que no es estudiante"
            )
        st = user.student
        if course is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ya existe un estudiante con ese registro"
            )
        already = db.scalar(
            select(Enrollment).where(
                Enrollment.student_id == st.id, Enrollment.course_id == course.id
            )
        )
        if already is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, f"El estudiante ya está inscrito en {course.code}"
            )
        db.add(Enrollment(student_id=st.id, course_id=course.id))
        db.commit()
        db.refresh(st)
        return _student_out(st)

    if email and db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese email")
    user = User(
        registration_code=code,
        email=email,
        full_name=body.full_name.strip(),
        role=UserRole.student,
        password_hash=hash_password(get_settings().default_password),
    )
    db.add(user)
    db.flush()
    st = Student(user_id=user.id, career=body.career)
    db.add(st)
    db.flush()
    if course is not None:
        db.add(Enrollment(student_id=st.id, course_id=course.id))
    db.commit()
    db.refresh(st)
    return _student_out(st)


@router.get("/{student_id}", response_model=StudentSummary, summary="Detalle de estudiante")
def get_student(
    student_id: UUID, db: DB, _: AdminUser, course_id: UUID | None = None
) -> StudentSummary:
    st = db.get(Student, student_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    return summarize(db, [st], course_id)[0]


@router.patch("/{student_id}", response_model=StudentOut, summary="Editar estudiante")
def update_student(student_id: UUID, body: StudentUpdate, db: DB, _: AdminUser) -> StudentOut:
    st = db.get(Student, student_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    if body.full_name is not None:
        st.user.full_name = body.full_name.strip()
    if body.career is not None:
        st.career = body.career.strip() or None
    if body.is_active is not None:
        st.user.is_active = body.is_active
    if body.reset_password:
        st.user.password_hash = hash_password(get_settings().default_password)
        st.user.must_change_password = False
    db.commit()
    db.refresh(st)
    return _student_out(st)


@router.get(
    "/{student_id}/attendance",
    response_model=MyAttendance,
    summary="Historial de asistencia de un estudiante",
)
def student_attendance(
    student_id: UUID, db: DB, _: AdminUser, course_id: UUID | None = None
) -> MyAttendance:
    st = db.get(Student, student_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estudiante no encontrado")
    items, stats = student_history(db, st, course_id)
    today = today_local()
    return MyAttendance(
        today=[i for i in items if i.session.session_date == today],
        history=items,
        stats=stats,
        server_now=now_local(),
        late_tolerance_minutes=get_settings().late_tolerance_minutes,
    )
