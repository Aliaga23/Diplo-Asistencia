export type Role = "admin" | "student"
export type AttendanceStatus = "present" | "late" | "absent" | "excused"
export type AttendanceSource = "self" | "admin" | "import"
export type ImportKind = "students" | "sessions"

export interface StudentProfile {
  id: string
  career: string | null
}

export interface User {
  id: string
  registration_code: string
  email: string | null
  full_name: string
  role: Role
  is_active: boolean
  must_change_password: boolean
  student: StudentProfile | null
}

export interface Course {
  id: string
  code: string
  name: string
  period: string
  students_count: number
  sessions_count: number
  sessions_done: number
  attendance_rate: number
}

export interface ClassSession {
  id: string
  course_id: string
  course_code: string
  course_name: string
  session_date: string
  start_time: string
  end_time: string
  topic: string | null
  is_today: boolean
  present: number
  late: number
  absent: number
  excused: number
  enrolled: number
}

export interface StudentSummary {
  id: string
  registration_code: string
  career: string | null
  user_id: string
  email: string | null
  full_name: string
  is_active: boolean
  sessions_total: number
  present: number
  late: number
  absent: number
  excused: number
  attendance_rate: number
}

export interface AttendanceRecord {
  id: string
  session_id: string
  student_id: string
  status: AttendanceStatus
  source: AttendanceSource
  marked_at: string
  marked_by: string | null
  note: string | null
}

export interface MatrixRow {
  student_id: string
  registration_code: string
  full_name: string
  email: string | null
  status: AttendanceStatus
  source: AttendanceSource | null
  marked_at: string | null
  note: string | null
  recorded: boolean
}

export interface AttendanceMatrix {
  session: ClassSession
  rows: MatrixRow[]
}

export interface HistoryItem {
  session: ClassSession
  status: AttendanceStatus
  source: AttendanceSource | null
  marked_at: string | null
  note: string | null
  recorded: boolean
  editable: boolean
}

export interface AttendanceStats {
  sessions_total: number
  present: number
  late: number
  absent: number
  excused: number
  attendance_rate: number
}

export interface MyAttendance {
  today: HistoryItem[]
  history: HistoryItem[]
  stats: AttendanceStats
  server_now: string
  late_tolerance_minutes: number
}

export interface ImportBatch {
  id: string
  kind: ImportKind
  filename: string
  course_id: string | null
  uploaded_by: string | null
  rows_total: number
  rows_ok: number
  rows_failed: number
  errors: { row: number; message: string }[]
  created_at: string
}

export interface SessionPoint {
  session_id: string
  label: string
  session_date: string
  present: number
  late: number
  absent: number
  excused: number
  rate: number
}

export interface DashboardStats {
  students_total: number
  sessions_total: number
  sessions_done: number
  attendance_rate: number
  today_session: ClassSession | null
  today_present: number
  today_late: number
  today_pending: number
  series: SessionPoint[]
  server_now: string
}
