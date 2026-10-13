from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import AttendanceSource, AttendanceStatus, ImportKind, UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class LoginRequest(BaseModel):
    registration_code: str = Field(min_length=1, max_length=50, examples=["218166141"])
    password: str = Field(min_length=1, examples=["admin1234!"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------- Users / Students ----------
class StudentProfile(ORMModel):
    id: UUID
    career: str | None = None


class UserOut(ORMModel):
    id: UUID
    registration_code: str
    email: EmailStr | None
    full_name: str
    role: UserRole
    is_active: bool
    must_change_password: bool
    student: StudentProfile | None = None


class StudentOut(ORMModel):
    id: UUID
    registration_code: str
    career: str | None
    user_id: UUID
    email: EmailStr | None
    full_name: str
    is_active: bool


class StudentSummary(StudentOut):
    sessions_total: int
    present: int
    late: int
    absent: int
    excused: int
    attendance_rate: float


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    career: str | None = Field(default=None, max_length=150)
    is_active: bool | None = None
    reset_password: bool = False


class StudentCreate(BaseModel):
    registration_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr | None = None
    career: str | None = Field(default=None, max_length=150)
    course_id: UUID | None = None


# ---------- Courses / Sessions ----------
class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=2, max_length=150)
    period: str = Field(min_length=1, max_length=30)


class CourseUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=2, max_length=150)
    period: str | None = Field(default=None, min_length=1, max_length=30)


class CourseOut(ORMModel):
    id: UUID
    code: str
    name: str
    period: str
    students_count: int = 0
    sessions_count: int = 0
    sessions_done: int = 0
    attendance_rate: float = 0.0


class SessionCreate(BaseModel):
    session_date: date
    start_time: time
    end_time: time
    topic: str | None = Field(default=None, max_length=200)


class SessionUpdate(BaseModel):
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    topic: str | None = Field(default=None, max_length=200)


class SessionOut(ORMModel):
    id: UUID
    course_id: UUID
    course_code: str = ""
    course_name: str = ""
    session_date: date
    start_time: time
    end_time: time
    topic: str | None
    is_today: bool = False
    present: int = 0
    late: int = 0
    absent: int = 0
    excused: int = 0
    enrolled: int = 0


# ---------- Attendance ----------
class AttendanceRecordOut(ORMModel):
    id: UUID
    session_id: UUID
    student_id: UUID
    status: AttendanceStatus
    source: AttendanceSource
    marked_at: datetime
    marked_by: UUID | None
    note: str | None


class AttendanceMatrixRow(BaseModel):
    student_id: UUID
    registration_code: str
    full_name: str
    email: str | None
    status: AttendanceStatus
    source: AttendanceSource | None = None
    marked_at: datetime | None = None
    note: str | None = None
    recorded: bool


class AttendanceMatrix(BaseModel):
    session: SessionOut
    rows: list[AttendanceMatrixRow]


class AdminAttendanceUpsert(BaseModel):
    status: AttendanceStatus
    note: str | None = Field(default=None, max_length=300)


class StudentHistoryItem(BaseModel):
    session: SessionOut
    status: AttendanceStatus
    source: AttendanceSource | None = None
    marked_at: datetime | None = None
    note: str | None = None
    recorded: bool
    editable: bool


class MyAttendance(BaseModel):
    today: list[StudentHistoryItem]
    history: list[StudentHistoryItem]
    stats: AttendanceStats
    server_now: datetime
    late_tolerance_minutes: int


class AttendanceStats(BaseModel):
    sessions_total: int
    present: int
    late: int
    absent: int
    excused: int
    attendance_rate: float


# ---------- Imports ----------
class ImportError_(BaseModel):
    row: int
    message: str


class ImportBatchOut(ORMModel):
    id: UUID
    kind: ImportKind
    filename: str
    course_id: UUID | None
    uploaded_by: UUID | None
    rows_total: int
    rows_ok: int
    rows_failed: int
    errors: list[ImportError_]
    created_at: datetime


# ---------- Dashboard ----------
class SessionPoint(BaseModel):
    session_id: UUID
    label: str
    session_date: date
    present: int
    late: int
    absent: int
    excused: int
    rate: float


class DashboardStats(BaseModel):
    students_total: int
    sessions_total: int
    sessions_done: int
    attendance_rate: float
    today_session: SessionOut | None
    today_present: int
    today_late: int
    today_pending: int
    series: list[SessionPoint]
    server_now: datetime
