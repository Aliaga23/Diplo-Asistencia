"use client"

import { useMarca } from "@/lib/marca"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-8 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" className="fill-[var(--brand)]" />
      <path
        d="M9 16.5l4.5 4.5L23 11.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="2.5" fill="white" fillOpacity="0.85" />
    </svg>
  )
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  const marca = useMarca()
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark />
      <div className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[15px] font-semibold tracking-tight">
          {marca?.sigla ? `Presencia ${marca.sigla}` : "Presencia"}
        </span>
        {subtitle && (
          <span
            className={cn(
              "mt-1 truncate text-[11px] font-medium tracking-wide text-current/60 uppercase transition-opacity",
              marca === null && "opacity-0"
            )}
          >
            {marca?.institucion ?? "Control de asistencia"}
          </span>
        )}
      </div>
    </div>
  )
}

/** Nombre de la institución, o el texto del grupo en la instalación propia. */
export function NombreMarca({ defecto, className }: { defecto: string; className?: string }) {
  const marca = useMarca()
  return (
    <span className={cn("transition-opacity", marca === null && "opacity-0", className)}>
      {marca?.institucion ?? defecto}
    </span>
  )
}
