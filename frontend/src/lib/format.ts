import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import type { AttendanceSource, AttendanceStatus } from "@/lib/types"

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  late: "Tarde",
  absent: "Falta",
  excused: "Justificado",
}

export const SOURCE_LABEL: Record<AttendanceSource, string> = {
  self: "Estudiante",
  admin: "Administrador",
  import: "Importación",
}

/** "2026-10-13" -> Date local sin desfase de zona horaria. */
export function parseDay(day: string): Date {
  return parseISO(day)
}

export function fmtDay(day: string, pattern = "EEE d 'de' MMM") {
  const s = format(parseDay(day), pattern, { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtLongDay(day: string) {
  return fmtDay(day, "EEEE d 'de' MMMM 'de' yyyy")
}

export function fmtTime(t: string) {
  return t.slice(0, 5)
}

export function fmtRange(start: string, end: string) {
  return `${fmtTime(start)} – ${fmtTime(end)}`
}

/** Hora de un timestamp ISO mostrada en la zona del servidor (America/La_Paz). */
export function fmtStamp(iso: string | null, withDate = false) {
  if (!iso) return "—"
  const d = new Date(iso)
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    hour: "2-digit",
    minute: "2-digit",
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
  }).format(d)
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function fmtPct(n: number) {
  return `${n.toLocaleString("es-BO", { maximumFractionDigits: 1 })}%`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[2]?.[0] ?? parts[1]?.[0] ?? "")).toUpperCase()
}

export function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 3) return `${parts[0]} ${parts[parts.length - 2]}`
  return name
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria oficial del sistema. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date())
}
