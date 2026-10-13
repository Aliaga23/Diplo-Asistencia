import enum
import uuid

from sqlalchemy import JSON, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin, db_enum


class ImportKind(enum.StrEnum):
    students = "students"
    sessions = "sessions"


class ImportBatch(UUIDMixin, TimestampMixin, Base):
    """Auditoría de cada importación desde Excel."""

    __tablename__ = "import_batches"

    kind: Mapped[ImportKind] = mapped_column(db_enum(ImportKind, "import_kind"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rows_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_ok: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), default=list, nullable=False
    )
