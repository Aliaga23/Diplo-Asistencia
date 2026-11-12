import { cn } from "@/lib/utils"
import { ESTADOS_OPERACION, ESTADOS_TENANT, type Tono } from "@/lib/formato"
import type { EstadoOperacion, EstadoTenant } from "@/lib/tipos"

const TONOS: Record<Tono, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  progreso: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  pausa: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  neutro: "border-border bg-muted text-muted-foreground",
}

function Pastilla({ texto, tono }: { texto: string; tono: Tono }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONOS[tono]
      )}
    >
      {tono === "progreso" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {texto}
    </span>
  )
}

export function EstadoTenantBadge({ estado }: { estado: EstadoTenant }) {
  return <Pastilla {...ESTADOS_TENANT[estado]} />
}

export function EstadoOperacionBadge({ estado }: { estado: EstadoOperacion }) {
  return <Pastilla {...ESTADOS_OPERACION[estado]} />
}
