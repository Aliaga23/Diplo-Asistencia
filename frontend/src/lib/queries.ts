"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type {
  AttendanceMatrix,
  AttendanceRecord,
  AttendanceStatus,
  ClassSession,
  Course,
  DashboardStats,
  ImportBatch,
  ImportKind,
  MyAttendance,
  StudentSummary,
  User,
} from "@/lib/types"

export const qk = {
  me: ["me"] as const,
  courses: ["courses"] as const,
  dashboard: (courseId?: string) => ["dashboard", courseId] as const,
  sessions: (courseId?: string) => ["sessions", courseId] as const,
  matrix: (sessionId: string) => ["matrix", sessionId] as const,
  students: (courseId?: string, q?: string) => ["students", courseId, q] as const,
  studentAttendance: (id: string, courseId?: string) => ["student-attendance", id, courseId] as const,
  imports: ["imports"] as const,
  myAttendance: ["my-attendance"] as const,
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => api.get<User>("/auth/me") })
}

export function useCourses() {
  return useQuery({ queryKey: qk.courses, queryFn: () => api.get<Course[]>("/courses") })
}

export function useDashboard(courseId?: string) {
  return useQuery({
    queryKey: qk.dashboard(courseId),
    queryFn: () => api.get<DashboardStats>(`/dashboard/stats?course_id=${courseId}`),
    enabled: !!courseId,
    refetchInterval: 30_000,
  })
}

export function useSessions(courseId?: string) {
  return useQuery({
    queryKey: qk.sessions(courseId),
    queryFn: () => api.get<ClassSession[]>(`/courses/${courseId}/sessions`),
    enabled: !!courseId,
  })
}

export function useMatrix(sessionId: string) {
  return useQuery({
    queryKey: qk.matrix(sessionId),
    queryFn: () => api.get<AttendanceMatrix>(`/attendance/sessions/${sessionId}`),
    refetchInterval: 20_000,
  })
}

export function useStudents(courseId?: string, q?: string) {
  const params = new URLSearchParams()
  if (courseId) params.set("course_id", courseId)
  if (q) params.set("q", q)
  return useQuery({
    queryKey: qk.students(courseId, q),
    queryFn: () => api.get<StudentSummary[]>(`/students?${params.toString()}`),
    enabled: !!courseId,
    placeholderData: (prev) => prev,
  })
}

export function useStudent(studentId: string, courseId?: string) {
  return useQuery({
    queryKey: ["student", studentId, courseId] as const,
    queryFn: () =>
      api.get<StudentSummary>(`/students/${studentId}${courseId ? `?course_id=${courseId}` : ""}`),
  })
}

export function useStudentAttendance(studentId: string | null, courseId?: string) {
  return useQuery({
    queryKey: qk.studentAttendance(studentId ?? "", courseId),
    queryFn: () =>
      api.get<MyAttendance>(
        `/students/${studentId}/attendance${courseId ? `?course_id=${courseId}` : ""}`
      ),
    enabled: !!studentId,
  })
}

export function useImports() {
  return useQuery({ queryKey: qk.imports, queryFn: () => api.get<ImportBatch[]>("/imports") })
}

export function useMyAttendance() {
  return useQuery({
    queryKey: qk.myAttendance,
    queryFn: () => api.get<MyAttendance>("/me/attendance"),
    refetchInterval: 60_000,
  })
}

/* ---------------------------- mutaciones ---------------------------- */

export function useSetAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: {
      sessionId: string
      studentId: string
      status: AttendanceStatus
      note?: string | null
    }) =>
      api.put<AttendanceRecord>(
        `/attendance/sessions/${v.sessionId}/students/${v.studentId}`,
        { status: v.status, note: v.note ?? null }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrix"] })
      qc.invalidateQueries({ queryKey: ["student-attendance"] })
      qc.invalidateQueries({ queryKey: ["students"] })
      qc.invalidateQueries({ queryKey: ["student"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["sessions"] })
    },
  })
}

export function useMarkMyAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<AttendanceRecord>(`/me/attendance/${sessionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myAttendance }),
  })
}

export function useCancelMyAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => api.delete<void>(`/me/attendance/${sessionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myAttendance }),
  })
}

export function useImportFile(kind: ImportKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { courseId: string; file: File }) =>
      api.upload<ImportBatch>(`/imports/${kind}?course_id=${v.courseId}`, v.file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.imports })
      qc.invalidateQueries({ queryKey: ["students"] })
      qc.invalidateQueries({ queryKey: ["sessions"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: qk.courses })
    },
  })
}

export function useCreateSession(courseId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { session_date: string; start_time: string; end_time: string; topic?: string }) =>
      api.post<ClassSession>(`/courses/${courseId}/sessions`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: qk.courses })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: qk.courses })
    },
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { code: string; name: string; period: string }) =>
      api.post<Course>("/courses", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; code?: string; name?: string; period?: string }) => {
      const { id, ...body } = v
      return api.patch<Course>(`/courses/${id}`, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  })
}

export function useUpdateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: {
      id: string
      full_name?: string
      career?: string
      is_active?: boolean
      reset_password?: boolean
    }) => {
      const { id, ...body } = v
      return api.patch<StudentSummary>(`/students/${id}`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] })
      qc.invalidateQueries({ queryKey: ["student"] })
    },
  })
}
