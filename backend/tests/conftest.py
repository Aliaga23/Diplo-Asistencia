import os
from collections.abc import Generator
from datetime import date, datetime, time

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-key-0123456789-abcdefghijkl"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.core.timeutils import tz
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import ClassSession, Course, Enrollment, Student, User, UserRole

FIXED_NOW = datetime(2026, 10, 13, 19, 5, tzinfo=tz())


@pytest.fixture()
def db() -> Generator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def _fk(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def clock(monkeypatch):
    """Congela el reloj del servicio de asistencia en FIXED_NOW (modificable)."""
    state = {"now": FIXED_NOW}

    def now():
        return state["now"]

    def today():
        return state["now"].date()

    for mod in (
        "app.services.attendance",
        "app.api.v1.attendance",
        "app.api.v1.students",
        "app.api.v1.dashboard",
    ):
        monkeypatch.setattr(f"{mod}.now_local", now, raising=False)
        monkeypatch.setattr(f"{mod}.today_local", today, raising=False)
    return state


@pytest.fixture()
def client(db: Session, clock) -> Generator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin(db: Session) -> User:
    u = User(
        registration_code="218166141",
        email="admin@test.com",
        full_name="Admin",
        role=UserRole.admin,
        password_hash=hash_password("admin1234!"),
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture()
def course(db: Session) -> Course:
    c = Course(code="TEST-1", name="Curso de prueba", period="2026-2")
    db.add(c)
    db.commit()
    return c


@pytest.fixture()
def student(db: Session, course: Course) -> Student:
    u = User(
        registration_code="2190001",
        email="ana@test.com",
        full_name="Ana Pérez",
        role=UserRole.student,
        password_hash=hash_password("admin1234!"),
    )
    db.add(u)
    db.flush()
    s = Student(user_id=u.id, career="Informática")
    db.add(s)
    db.flush()
    db.add(Enrollment(student_id=s.id, course_id=course.id))
    db.commit()
    return s


def make_session(db: Session, course: Course, d: date, start: time, end: time) -> ClassSession:
    s = ClassSession(course_id=course.id, session_date=d, start_time=start, end_time=end)
    db.add(s)
    db.commit()
    return s


def login(client: TestClient, registro: str, password: str = "admin1234!") -> dict:
    r = client.post(
        "/api/v1/auth/login", json={"registration_code": registro, "password": password}
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
