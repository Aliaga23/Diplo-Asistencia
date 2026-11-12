import { format, formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"

import type { EstadoOperacion, EstadoTenant } from "@/lib/tipos"

export const ESTADOS_TENANT: Record<EstadoTenant, { texto: string; tono: Tono }> = {
  creando: { texto: "Creando", tono: "progreso" },
  activo: { texto: "Activo", tono: "ok" },
  suspendiendo: { texto: "Suspendiendo", tono: "progreso" },
  suspendido: { texto: "Suspendido", tono: "pausa" },
  reanudando: { texto: "Reanudando", tono: "progreso" },
  eliminando: { texto: "Eliminando", tono: "progreso" },
  eliminado: { texto: "Eliminado", tono: "neutro" },
  error: { texto: "Error", tono: "error" },
}

export const ESTADOS_OPERACION: Record<EstadoOperacion, { texto: string; tono: Tono }> = {
  pendiente: { texto: "En cola", tono: "neutro" },
  ejecutando: { texto: "Ejecutando", tono: "progreso" },
  exitosa: { texto: "Exitosa", tono: "ok" },
  fallida: { texto: "Fallida", tono: "error" },
}

export const TIPOS_OPERACION = {
  crear: "Crear",
  suspender: "Suspender",
  reanudar: "Reanudar",
  eliminar: "Eliminar",
} as const

export const PLANES = { basico: "Básico", estandar: "Estándar", avanzado: "Avanzado" } as const
export const MOTORES = { terraform: "Terraform", pulumi: "Pulumi" } as const
export const ENTORNOS: Record<string, string> = { produccion: "Producción", pruebas: "Pruebas" }

export type Tono = "ok" | "error" | "progreso" | "pausa" | "neutro"

export function fecha(valor: string | null | undefined) {
  return valor ? format(new Date(valor), "dd/MM/yyyy HH:mm", { locale: es }) : "—"
}

export function hace(valor: string | null | undefined) {
  return valor ? formatDistanceToNowStrict(new Date(valor), { locale: es, addSuffix: true }) : "—"
}

export function duracion(desde: string | null, hasta: string | null) {
  if (!desde) return "—"
  const segundos = Math.round(((hasta ? new Date(hasta) : new Date()).getTime() - new Date(desde).getTime()) / 1000)
  const minutos = Math.floor(segundos / 60)
  return minutos ? `${minutos} min ${segundos % 60} s` : `${segundos} s`
}
