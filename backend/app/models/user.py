import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin, db_enum


class UserRole(enum.StrEnum):
    admin = "admin"
    student = "student"


class User(UUIDMixin, TimestampMixin, Base):
    """Cuenta de acceso. El número de registro es el identificador de ingreso de todos."""

    __tablename__ = "users"

    registration_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(db_enum(UserRole, "user_role"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    student: Mapped[Student | None] = relationship(back_populates="user", uselist=False)


class Student(UUIDMixin, TimestampMixin, Base):
    """Perfil académico del estudiante (especialización 1:1 de users)."""

    __tablename__ = "students"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    career: Mapped[str | None] = mapped_column(String(150))

    user: Mapped[User] = relationship(back_populates="student")
    enrollments: Mapped[list[Enrollment]] = relationship(  # noqa: F821
        back_populates="student", cascade="all, delete-orphan"
    )
