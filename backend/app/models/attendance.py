import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin, db_enum


class AttendanceStatus(enum.StrEnum):
    present = "present"
    late = "late"
    absent = "absent"
    excused = "excused"


class AttendanceSource(enum.StrEnum):
    self = "self"
    admin = "admin"
    import_ = "import"


class AttendanceRecord(UUIDMixin, TimestampMixin, Base):
    """Un registro de asistencia por estudiante y sesión."""

    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_attendance"),)

    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        db_enum(AttendanceStatus, "attendance_status"), nullable=False
    )
    source: Mapped[AttendanceSource] = mapped_column(
        db_enum(AttendanceSource, "attendance_source"), nullable=False
    )
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    marked_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(String(300))

    session: Mapped[ClassSession] = relationship(back_populates="attendance_records")  # noqa: F821
    student: Mapped[Student] = relationship()  # noqa: F821
