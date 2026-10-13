from datetime import date, time, timedelta

from tests.conftest import FIXED_NOW, login, make_session

TODAY = FIXED_NOW.date()


def test_login_and_me(client, admin):
    h = login(client, "218166141")
    r = client.get("/api/v1/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_login_wrong_password(client, admin):
    r = client.post("/api/v1/auth/login", json={"registration_code": "218166141", "password": "x"})
    assert r.status_code == 401


def test_login_unknown_registration(client, admin):
    r = client.post(
        "/api/v1/auth/login", json={"registration_code": "000000", "password": "admin1234!"}
    )
    assert r.status_code == 401


def test_student_marks_today_on_time_is_present(client, db, course, student):
    s = make_session(db, course, TODAY, time(19, 0), time(21, 0))  # reloj: 19:05
    h = login(client, "2190001")
    r = client.post(f"/api/v1/me/attendance/{s.id}", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "present"
    assert r.json()["source"] == "self"


def test_student_marks_after_tolerance_is_late(client, db, course, student):
    s = make_session(db, course, TODAY, time(18, 0), time(21, 0))  # 65 min tarde
    h = login(client, "2190001")
    r = client.post(f"/api/v1/me/attendance/{s.id}", headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "late"


def test_student_cannot_mark_other_day(client, db, course, student):
    yesterday = make_session(db, course, TODAY - timedelta(days=1), time(19, 0), time(21, 0))
    tomorrow = make_session(db, course, TODAY + timedelta(days=1), time(19, 0), time(21, 0))
    h = login(client, "2190001")
    for s in (yesterday, tomorrow):
        r = client.post(f"/api/v1/me/attendance/{s.id}", headers=h)
        assert r.status_code == 403
        assert "hoy" in r.json()["detail"]


def test_remark_is_idempotent_and_never_downgrades(client, db, course, student, clock):
    s = make_session(db, course, TODAY, time(19, 0), time(21, 0))
    h = login(client, "2190001")
    first = client.post(f"/api/v1/me/attendance/{s.id}", headers=h).json()
    assert first["status"] == "present"
    clock["now"] = FIXED_NOW.replace(hour=20, minute=30)  # ya pasó la tolerancia
    again = client.post(f"/api/v1/me/attendance/{s.id}", headers=h).json()
    assert again["status"] == "present"
    assert again["id"] == first["id"]
    clock["now"] = FIXED_NOW + timedelta(days=1)
    assert client.post(f"/api/v1/me/attendance/{s.id}", headers=h).status_code == 403


def test_student_can_cancel_only_today_and_only_own(client, db, course, student, admin, clock):
    s = make_session(db, course, TODAY, time(19, 0), time(21, 0))
    hs = login(client, "2190001")
    client.post(f"/api/v1/me/attendance/{s.id}", headers=hs)
    assert client.delete(f"/api/v1/me/attendance/{s.id}", headers=hs).status_code == 204
    assert client.delete(f"/api/v1/me/attendance/{s.id}", headers=hs).status_code == 404
    # un registro del administrador queda bloqueado para el estudiante
    ha = login(client, "218166141")
    client.put(
        f"/api/v1/attendance/sessions/{s.id}/students/{student.id}",
        json={"status": "excused"},
        headers=ha,
    )
    assert client.delete(f"/api/v1/me/attendance/{s.id}", headers=hs).status_code == 403
    assert client.post(f"/api/v1/me/attendance/{s.id}", headers=hs).json()["status"] == "excused"
    # al día siguiente ya no puede anular
    clock["now"] = FIXED_NOW + timedelta(days=1)
    assert client.delete(f"/api/v1/me/attendance/{s.id}", headers=hs).status_code == 403


def test_student_not_enrolled_is_rejected(client, db, course, student):
    from app.models import Course

    other = Course(code="OTRO", name="Otro curso", period="2026-2")
    db.add(other)
    db.commit()
    s = make_session(db, other, TODAY, time(19, 0), time(21, 0))
    h = login(client, "2190001")
    assert client.post(f"/api/v1/me/attendance/{s.id}", headers=h).status_code == 403


def test_admin_edits_any_date(client, db, course, student, admin):
    old = make_session(db, course, date(2026, 9, 1), time(19, 0), time(21, 0))
    h = login(client, "218166141")
    r = client.put(
        f"/api/v1/attendance/sessions/{old.id}/students/{student.id}",
        json={"status": "excused", "note": "Certificado médico"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "excused"
    assert r.json()["source"] == "admin"
    matrix = client.get(f"/api/v1/attendance/sessions/{old.id}", headers=h).json()
    assert matrix["rows"][0]["status"] == "excused"
    assert matrix["rows"][0]["note"] == "Certificado médico"


def test_student_cannot_use_admin_endpoints(client, db, course, student):
    s = make_session(db, course, TODAY, time(19, 0), time(21, 0))
    h = login(client, "2190001")
    r = client.put(
        f"/api/v1/attendance/sessions/{s.id}/students/{student.id}",
        json={"status": "present"},
        headers=h,
    )
    assert r.status_code == 403
    assert client.get("/api/v1/students", headers=h).status_code == 403


def test_my_attendance_stats(client, db, course, student, admin):
    past = make_session(db, course, TODAY - timedelta(days=2), time(19, 0), time(21, 0))
    make_session(db, course, TODAY - timedelta(days=1), time(19, 0), time(21, 0))
    today = make_session(db, course, TODAY, time(19, 0), time(21, 0))
    make_session(db, course, TODAY + timedelta(days=7), time(19, 0), time(21, 0))
    ha = login(client, "218166141")
    client.put(
        f"/api/v1/attendance/sessions/{past.id}/students/{student.id}",
        json={"status": "present"},
        headers=ha,
    )
    hs = login(client, "2190001")
    client.post(f"/api/v1/me/attendance/{today.id}", headers=hs)
    data = client.get("/api/v1/me/attendance", headers=hs).json()
    assert len(data["today"]) == 1 and data["today"][0]["editable"] is True
    # La sesión de hoy (19:00-21:00) aún no termina a las 19:05: no cuenta como dictada.
    assert data["stats"]["sessions_total"] == 2
    assert data["stats"]["present"] == 1
    assert data["stats"]["absent"] == 1
    assert data["stats"]["attendance_rate"] == 50.0


def test_session_counts_once_finished(client, db, course, student, clock):
    today = make_session(db, course, TODAY, time(19, 0), time(21, 0))
    hs = login(client, "2190001")
    client.post(f"/api/v1/me/attendance/{today.id}", headers=hs)
    clock["now"] = FIXED_NOW.replace(hour=21, minute=30)
    data = client.get("/api/v1/me/attendance", headers=hs).json()
    assert data["stats"]["sessions_total"] == 1
    assert data["stats"]["attendance_rate"] == 100.0


def test_change_password_clears_flag(client, db, student):
    student.user.must_change_password = True
    db.commit()
    h = login(client, "2190001")
    r = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "admin1234!", "new_password": "NuevaClave2026"},
        headers=h,
    )
    assert r.status_code == 204
    assert client.get("/api/v1/auth/me", headers=h).json()["must_change_password"] is False
    login(client, "2190001", "NuevaClave2026")


def test_dashboard_stats(client, db, course, student, admin):
    make_session(db, course, TODAY, time(19, 0), time(21, 0))
    h = login(client, "218166141")
    r = client.get("/api/v1/dashboard/stats", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["students_total"] == 1
    assert body["today_session"] is not None
    assert body["today_pending"] == 1
