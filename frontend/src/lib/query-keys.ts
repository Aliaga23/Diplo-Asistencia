/**
 * Claves de TanStack Query compartidas por el servidor (precarga) y el cliente.
 * Este módulo no es "use client": un Server Component no puede leer valores de un
 * módulo de cliente, solo referencias.
 */
export const qk = {
  me: ["me"] as const,
  courses: ["courses"] as const,
  dashboard: (courseId?: string) => ["dashboard", courseId] as const,
  sessions: (courseId?: string) => ["sessions", courseId] as const,
  matrix: (sessionId: string) => ["matrix", sessionId] as const,
  students: (courseId?: string, q?: string) => ["students", courseId, q] as const,
  student: (id: string, courseId?: string) => ["student", id, courseId] as const,
  studentAttendance: (id: string, courseId?: string) =>
    ["student-attendance", id, courseId] as const,
  imports: ["imports"] as const,
  myAttendance: ["my-attendance"] as const,
}

/** Ruta de la API (/api/v1) que alimenta cada clave; la usa la precarga del servidor. */
export const apiPath = {
  me: "/auth/me",
  courses: "/courses",
  dashboard: (courseId: string) => `/dashboard/stats?course_id=${courseId}`,
  sessions: (courseId: string) => `/courses/${courseId}/sessions`,
  matrix: (sessionId: string) => `/attendance/sessions/${sessionId}`,
  students: (courseId: string) => `/students?course_id=${courseId}`,
  student: (id: string, courseId: string) => `/students/${id}?course_id=${courseId}`,
  studentAttendance: (id: string, courseId: string) =>
    `/students/${id}/attendance?course_id=${courseId}`,
  imports: "/imports",
  myAttendance: "/me/attendance",
}
