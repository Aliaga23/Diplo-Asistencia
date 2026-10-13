from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DB, AdminUser, CurrentUser
from app.models import AttendanceStatus, ClassSession, Course, Enrollment, UserRole
from app.schemas import (
    CourseCreate,
    CourseOut,
    CourseUpdate,
    SessionCreate,
    SessionOut,
    SessionUpdate,
)
from app.services.attendance import enrolled_count, is_closed, session_out

router = APIRouter(tags=["Programas y sesiones"])


def _course_out(db, c: Course) -> CourseOut:
    sessions = db.scalars(
        select(ClassSession)
        .options(selectinload(ClassSession.attendance_records))
        .where(ClassSession.course_id == c.id)
    ).all()
    enrolled = enrolled_count(db, c.id)
    done = [s for s in sessions if is_closed(s)]
    attended = sum(
        1
        for s in done
        for r in s.attendance_records
        if r.status in (AttendanceStatus.present, AttendanceStatus.late)
    )
    possible = enrolled * len(done)
    return CourseOut(
        id=c.id,
        code=c.code,
        name=c.name,
        period=c.period,
        students_count=enrolled,
        sessions_count=len(sessions),
        sessions_done=len(done),
        attendance_rate=round(attended / possible * 100, 1) if possible else 0.0,
    )


@router.get("/courses", response_model=list[CourseOut], summary="Listar programas")
def list_courses(db: DB, user: CurrentUser) -> list[CourseOut]:
    stmt = select(Course).order_by(Course.created_at)
    if user.role == UserRole.student and user.student is not None:
        stmt = stmt.join(Enrollment).where(Enrollment.student_id == user.student.id)
    return [_course_out(db, c) for c in db.scalars(stmt).all()]


@router.post(
    "/courses",
    response_model=CourseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear programa",
)
def create_course(body: CourseCreate, db: DB, _: AdminUser) -> CourseOut:
    if db.scalar(select(Course).where(Course.code == body.code.strip().upper())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un programa con ese código")
    course = Course(code=body.code.strip().upper(), name=body.name.strip(), period=body.period)
    db.add(course)
    db.commit()
    db.refresh(course)
    return _course_out(db, course)


@router.patch("/courses/{course_id}", response_model=CourseOut, summary="Editar programa")
def update_course(course_id: UUID, body: CourseUpdate, db: DB, _: AdminUser) -> CourseOut:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Programa no encontrado")
    data = body.model_dump(exclude_unset=True)
    if "code" in data:
        code = data["code"].strip().upper()
        clash = db.scalar(select(Course).where(Course.code == code, Course.id != course.id))
        if clash is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un programa con ese código")
        course.code = code
    if "name" in data:
        course.name = data["name"].strip()
    if "period" in data:
        course.period = data["period"].strip()
    db.commit()
    db.refresh(course)
    return _course_out(db, course)


@router.get(
    "/courses/{course_id}/sessions",
    response_model=list[SessionOut],
    summary="Sesiones (horarios) de un programa",
)
def list_sessions(course_id: UUID, db: DB, _: AdminUser) -> list[SessionOut]:
    if db.get(Course, course_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Programa no encontrado")
    enrolled = enrolled_count(db, course_id)
    sessions = db.scalars(
        select(ClassSession)
        .options(selectinload(ClassSession.attendance_records))
        .where(ClassSession.course_id == course_id)
        .order_by(ClassSession.session_date, ClassSession.start_time)
    ).all()
    return [session_out(db, s, enrolled) for s in sessions]


@router.post(
    "/courses/{course_id}/sessions",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear sesión manualmente",
)
def create_session(course_id: UUID, body: SessionCreate, db: DB, _: AdminUser) -> SessionOut:
    if db.get(Course, course_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Programa no encontrado")
    if body.end_time <= body.start_time:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "La hora de fin debe ser posterior al inicio"
        )
    s = ClassSession(course_id=course_id, **body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return session_out(db, s)


@router.patch("/sessions/{session_id}", response_model=SessionOut, summary="Editar sesión")
def update_session(session_id: UUID, body: SessionUpdate, db: DB, _: AdminUser) -> SessionOut:
    s = db.get(ClassSession, session_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    if s.end_time <= s.start_time:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "La hora de fin debe ser posterior al inicio"
        )
    db.commit()
    db.refresh(s)
    return session_out(db, s)


@router.delete(
    "/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar sesión"
)
def delete_session(session_id: UUID, db: DB, _: AdminUser) -> None:
    s = db.get(ClassSession, session_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")
    db.delete(s)
    db.commit()
