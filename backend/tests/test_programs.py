from datetime import time, timedelta

from app.models import Course, Enrollment
from tests.conftest import FIXED_NOW, login, make_session

TODAY = FIXED_NOW.date()


def test_create_and_edit_program(client, admin):
    h = login(client, "218166141")
    r = client.post(
        "/api/v1/courses",
        json={"code": "dip-ia", "name": "Inteligencia Artificial", "period": "2026-II"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    course = r.json()
    assert course["code"] == "DIP-IA"
    r = client.patch(f"/api/v1/courses/{course['id']}", json={"name": "IA Aplicada"}, headers=h)
    assert r.status_code == 200
    assert r.json()["name"] == "IA Aplicada"
    dup = client.post(
        "/api/v1/courses", json={"code": "DIP-IA", "name": "Otro", "period": "x"}, headers=h
    )
    assert dup.status_code == 409


def test_existing_student_is_enrolled_in_second_program(client, db, admin, student, course):
    other = Course(code="DIP-IA", name="IA", period="2026-II")
    db.add(other)
    db.commit()
    h = login(client, "218166141")
    r = client.post(
        "/api/v1/students",
        json={"registration_code": "2190001", "full_name": "Ana Pérez", "course_id": str(other.id)},
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert db.query(Enrollment).filter_by(student_id=student.id).count() == 2
    again = client.post(
        "/api/v1/students",
        json={"registration_code": "2190001", "full_name": "Ana Pérez", "course_id": str(other.id)},
        headers=h,
    )
    assert again.status_code == 409


def test_student_sees_today_sessions_of_all_programs(client, db, student, course):
    other = Course(code="DIP-IA", name="IA", period="2026-II")
    db.add(other)
    db.flush()
    db.add(Enrollment(student_id=student.id, course_id=other.id))
    db.commit()
    make_session(db, course, TODAY, time(19, 0), time(21, 0))
    s2 = make_session(db, other, TODAY, time(8, 0), time(10, 0))
    h = login(client, "2190001")
    data = client.get("/api/v1/me/attendance", headers=h).json()
    assert {t["session"]["course_code"] for t in data["today"]} == {"TEST-1", "DIP-IA"}
    # puede marcar en cualquiera de sus programas el mismo día
    r = client.post(f"/api/v1/me/attendance/{s2.id}", headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "late"  # 19:05 > 08:00 + tolerancia


def test_program_stats(client, db, admin, student, course):
    past = make_session(db, course, TODAY - timedelta(days=1), time(19, 0), time(21, 0))
    make_session(db, course, TODAY + timedelta(days=1), time(19, 0), time(21, 0))
    h = login(client, "218166141")
    client.put(
        f"/api/v1/attendance/sessions/{past.id}/students/{student.id}",
        json={"status": "present"},
        headers=h,
    )
    courses = client.get("/api/v1/courses", headers=h).json()
    c = next(x for x in courses if x["code"] == "TEST-1")
    assert c["students_count"] == 1
    assert c["sessions_count"] == 2
    assert c["sessions_done"] == 1
    assert c["attendance_rate"] == 100.0


def test_student_summary_is_scoped_to_program(client, db, admin, student, course):
    other = Course(code="DIP-IA", name="IA", period="2026-II")
    db.add(other)
    db.flush()
    db.add(Enrollment(student_id=student.id, course_id=other.id))
    db.commit()
    make_session(db, course, TODAY - timedelta(days=1), time(19, 0), time(21, 0))
    make_session(db, other, TODAY - timedelta(days=1), time(8, 0), time(10, 0))
    make_session(db, other, TODAY - timedelta(days=2), time(8, 0), time(10, 0))
    h = login(client, "218166141")
    a = client.get("/api/v1/students", params={"course_id": str(course.id)}, headers=h).json()
    b = client.get("/api/v1/students", params={"course_id": str(other.id)}, headers=h).json()
    assert a[0]["sessions_total"] == 1
    assert b[0]["sessions_total"] == 2
    hist = client.get(
        f"/api/v1/students/{student.id}/attendance",
        params={"course_id": str(other.id)},
        headers=h,
    ).json()
    assert {i["session"]["course_code"] for i in hist["history"]} == {"DIP-IA"}
