import {
  CalendarDotsIcon,
  ClockCounterClockwiseIcon,
  FileArrowUpIcon,
  FingerprintSimpleIcon,
  GraduationCapIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

export interface NavItem {
  title: string
  href: string
  icon: Icon
  exact?: boolean
}

export const ADMIN_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "General",
    items: [{ title: "Panel", href: "/admin", icon: SquaresFourIcon, exact: true }],
  },
  {
    label: "Gestión académica",
    items: [
      { title: "Programas", href: "/admin/programas", icon: GraduationCapIcon },
      { title: "Estudiantes", href: "/admin/estudiantes", icon: UsersThreeIcon },
      { title: "Sesiones y asistencia", href: "/admin/sesiones", icon: CalendarDotsIcon },
      { title: "Importaciones", href: "/admin/importaciones", icon: FileArrowUpIcon },
    ],
  },
]

export const STUDENT_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Mi asistencia",
    items: [
      { title: "Registrar hoy", href: "/estudiante", icon: FingerprintSimpleIcon, exact: true },
      { title: "Historial", href: "/estudiante/historial", icon: ClockCounterClockwiseIcon },
    ],
  },
]
