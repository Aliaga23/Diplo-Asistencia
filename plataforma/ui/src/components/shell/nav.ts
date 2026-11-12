import {
  BellRingingIcon,
  BuildingsIcon,
  ChartLineIcon,
  PlusCircleIcon,
  SquaresFourIcon,
  StackIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

export const GRAFANA_URL = "/grafana/d/salud-tenants"

export interface NavItem {
  title: string
  href: string
  icon: Icon
  exact?: boolean
  externo?: boolean
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "General",
    items: [{ title: "Panel", href: "/panel", icon: SquaresFourIcon, exact: true }],
  },
  {
    label: "Tenants",
    items: [
      { title: "Instituciones", href: "/tenants", icon: BuildingsIcon },
      { title: "Nuevo tenant", href: "/tenants/nuevo", icon: PlusCircleIcon, exact: true },
      { title: "Catálogo de planes", href: "/planes", icon: StackIcon },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Alertas y eventos", href: "/eventos", icon: BellRingingIcon },
      { title: "Grafana", href: GRAFANA_URL, icon: ChartLineIcon, externo: true },
    ],
  },
]

export function activo(item: NavItem, ruta: string) {
  if (item.externo) return false
  if (item.href === "/tenants") return ruta === "/tenants" || /^\/tenants\/(?!nuevo$)/.test(ruta)
  return item.exact ? ruta === item.href : ruta.startsWith(item.href)
}

export async function cerrarSesion() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
  window.location.assign("/login")
}
