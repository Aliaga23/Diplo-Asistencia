import uuid
from datetime import date, time

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Time, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Course(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "courses"

    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    period: Mapped[str] = mapped_column(String(30), nullable=False)

    sessions: Mapped[list[ClassSession]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class Enrollment(UUIDMixin, TimestampMixin, Base):
    """Relación N:M entre estudiantes y cursos."""

    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_enrollment"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )

    student: Mapped[Student] = relationship(back_populates="enrollments")  # noqa: F821
    course: Mapped[Course] = relationship(back_populates="enrollments")


class ClassSession(UUIDMixin, TimestampMixin, Base):
    """Sesión de clase (fecha + horario) de un curso."""

    __tablename__ = "class_sessions"
    __table_args__ = (
        UniqueConstraint("course_id", "session_date", "start_time", name="uq_session_slot"),
        CheckConstraint("end_time > start_time", name="ck_session_time_range"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    topic: Mapped[str | None] = mapped_column(String(200))

    course: Mapped[Course] = relationship(back_populates="sessions")
    attendance_records: Mapped[list[AttendanceRecord]] = relationship(  # noqa: F821
        back_populates="session", cascade="all, delete-orphan"
    )
