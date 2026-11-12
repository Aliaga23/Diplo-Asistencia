import { CheckCircleIcon, CheckIcon, CpuIcon, DatabaseIcon, HardDrivesIcon, StudentIcon } from "@phosphor-icons/react/ssr"

import { cn } from "@/lib/utils"
import type { Plan } from "@/lib/tipos"

export const DESTACADO: Plan["id"] = "estandar"

function baseDeDatos(plan: Plan) {
  const bd = plan.bd
  if (bd.modo === "local") return `PostgreSQL en el mismo servidor`
  if (bd.modo === "ec2") return `Servidor propio ${bd.tipo} · ${bd.vcpu} vCPU · ${bd.memoria_gib} GiB`
  return `Amazon RDS ${bd.clase} · PostgreSQL ${bd.version}`
}

function incluye(plan: Plan) {
  const comunes = ["Red privada y firewall propios", "URL fija con IP elástica", "Monitoreo en Grafana"]
  if (plan.bd.modo === "rds") return [`Respaldo automático diario`, "Base administrada por AWS", ...comunes]
  if (plan.bd.modo === "ec2") return ["Base de datos aislada en su servidor", "Contraseñas en SSM cifradas", ...comunes]
  return ["Todo en un solo servidor", "Contraseñas en SSM cifradas", ...comunes]
}

export function precio(plan: Plan) {
  return plan.costo_dia_usd.toLocaleString("es-BO", { minimumFractionDigits: 2 })
}

export function PlanTarjeta({
  plan,
  seleccionado,
  onSeleccionar,
  accion,
  oscuro = false,
}: {
  plan: Plan
  seleccionado?: boolean
  onSeleccionar?: () => void
  accion?: React.ReactNode
  oscuro?: boolean
}) {
  const destacado = plan.id === DESTACADO
  const Contenedor = onSeleccionar ? "button" : "div"
  const specs = [
    { icono: StudentIcon, texto: `Hasta ${plan.estudiantes.toLocaleString("es-BO")} estudiantes` },
    { icono: CpuIcon, texto: `App ${plan.app.tipo} · ${plan.app.vcpu} vCPU · ${plan.app.memoria_gib} GiB` },
    { icono: DatabaseIcon, texto: baseDeDatos(plan) },
    {
      icono: HardDrivesIcon,
      texto:
        plan.bd.modo === "local"
          ? `Disco de ${plan.app.disco_gb} GB`
          : `Disco ${plan.app.disco_gb} GB + base ${plan.bd.almacenamiento_gb} GB`,
    },
  ]

  return (
    <Contenedor
      type={onSeleccionar ? "button" : undefined}
      onClick={onSeleccionar}
      className={cn(
        "relative flex h-full flex-col rounded-2xl border p-6 text-left transition-all",
        oscuro ? "border-white/10 bg-white/[0.03] text-white" : "bg-card",
        destacado && (oscuro ? "border-[oklch(0.62_0.21_263)] bg-white/[0.06]" : "border-primary/40 shadow-sm"),
        onSeleccionar && "cursor-pointer hover:border-primary/70",
        seleccionado && "border-primary ring-2 ring-primary/30"
      )}
    >
      {destacado && (
        <span
          className={cn(
            "absolute -top-3 left-6 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
            oscuro ? "bg-[oklch(0.62_0.21_263)] text-white" : "bg-primary text-primary-foreground"
          )}
        >
          Recomendado
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">{plan.nombre}</h3>
          <p className={cn("min-h-10 text-sm leading-snug", oscuro ? "text-white/55" : "text-muted-foreground")}>
            {plan.descripcion}
          </p>
        </div>
        {seleccionado && <CheckCircleIcon weight="fill" className="size-6 shrink-0 text-primary" />}
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-sm font-medium opacity-70">US$</span>
        <span className="text-4xl font-semibold tracking-tight tabular">{precio(plan)}</span>
        <span className={cn("text-sm", oscuro ? "text-white/55" : "text-muted-foreground")}>por día</span>
      </div>

      <ul className={cn("mt-5 space-y-2.5 border-t pt-5 text-sm", oscuro && "border-white/10")}>
        {specs.map((s) => (
          <li key={s.texto} className="flex gap-2.5">
            <s.icono
              weight="duotone"
              className={cn("mt-0.5 size-4 shrink-0", oscuro ? "text-[oklch(0.75_0.14_250)]" : "text-primary")}
            />
            <span>{s.texto}</span>
          </li>
        ))}
      </ul>

      <ul
        className={cn(
          "mt-5 flex-1 space-y-2 border-t pt-5 text-[13px]",
          oscuro ? "border-white/10 text-white/65" : "text-muted-foreground"
        )}
      >
        {incluye(plan).map((t) => (
          <li key={t} className="flex gap-2">
            <CheckIcon weight="bold" className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            {t}
          </li>
        ))}
      </ul>

      {accion && <div className="mt-6">{accion}</div>}
    </Contenedor>
  )
}
