import io
from datetime import date, datetime, time

from openpyxl import Workbook

from app.models import ClassSession, Enrollment, User
from tests.conftest import login


def _xlsx(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _upload(client, h, kind, course_id, content, name="datos.xlsx"):
    return client.post(
        f"/api/v1/imports/{kind}",
        params={"course_id": str(course_id)},
        files={"file": (name, content, "application/octet-stream")},
        headers=h,
    )


def test_import_students_creates_users_and_enrollments(client, db, admin, course):
    content = _xlsx(
        [
            ["Registro", "Nombre", "Correo", "Programa"],
            [219001, "Luis Rojas", "luis@test.com", "Sistemas"],
            ["219002", "María Vaca", "MARIA@test.com", None],
            ["219003", "Sin correo", None, None],
            ["219004", "Correo malo", "no-es-email", None],
        ]
    )
    h = login(client, "218166141")
    r = _upload(client, h, "students", course.id, content)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rows_total"] == 4
    assert body["rows_ok"] == 3  # el email es opcional
    assert body["rows_failed"] == 1
    assert {e["row"] for e in body["errors"]} == {5}

    maria = db.query(User).filter_by(email="maria@test.com").one()
    assert maria.registration_code == "219002"
    assert maria.must_change_password is False
    assert db.query(User).filter_by(registration_code="219001").one().student is not None
    assert db.query(Enrollment).count() == 3
    # todos ingresan con su registro y la contraseña común
    login(client, "219001", "admin1234!")

    # idempotente: reimportar no duplica
    r2 = _upload(client, h, "students", course.id, content)
    assert r2.json()["rows_ok"] == 3
    assert db.query(Enrollment).count() == 3


def test_import_sessions_parses_formats_and_upserts(client, db, admin, course):
    content = _xlsx(
        [
            ["fecha", "hora_inicio", "hora_fin", "tema"],
            [date(2026, 10, 13), time(19, 0), time(21, 0), "Intro"],
            ["14/10/2026", "19:00", "21:00", "Modelo de datos"],
            [datetime(2026, 10, 15), "19:00", "18:00", "Fin antes de inicio"],
            ["fecha mala", "19:00", "21:00", None],
        ]
    )
    h = login(client, "218166141")
    r = _upload(client, h, "sessions", course.id, content)
    body = r.json()
    assert body["rows_ok"] == 2
    assert body["rows_failed"] == 2
    assert db.query(ClassSession).count() == 2
    again = _upload(client, h, "sessions", course.id, content)
    assert again.json()["rows_ok"] == 2
    assert db.query(ClassSession).count() == 2


def test_import_rejects_missing_columns_and_non_xlsx(client, admin, course):
    h = login(client, "218166141")
    bad = _xlsx([["nombre", "otra"], ["x", "y"]])
    r = _upload(client, h, "students", course.id, bad)
    assert r.status_code == 400
    assert "Faltan columnas" in r.json()["detail"]
    r = _upload(client, h, "students", course.id, b"hola", name="datos.csv")
    assert r.status_code == 400


def test_templates_download(client, admin):
    h = login(client, "218166141")
    for kind in ("students", "sessions"):
        r = client.get(f"/api/v1/imports/templates/{kind}", headers=h)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"


def test_export_report(client, db, admin, course, student):
    db.add(
        ClassSession(
            course_id=course.id,
            session_date=date(2026, 10, 1),
            start_time=time(19, 0),
            end_time=time(21, 0),
        )
    )
    db.commit()
    h = login(client, "218166141")
    r = client.get("/api/v1/reports/attendance.xlsx", headers=h)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"
