"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { STATUS_LABEL } from "@/lib/format"
import type { AttendanceStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const ORDER: { key: AttendanceStatus; className: string }[] = [
  { key: "present", className: "bg-status-present" },
  { key: "late", className: "bg-status-late" },
  { key: "excused", className: "bg-status-excused" },
  { key: "absent", className: "bg-status-absent" },
]

/** Barra proporcional compacta con la distribución de estados de una sesión. */
export function AttendanceBar({
  counts,
  pending = false,
  className,
}: {
  counts: Record<AttendanceStatus, number>
  /** Si la sesión aún no ocurre, las faltas se muestran como "sin registro". */
  pending?: boolean
  className?: string
}) {
  const total = ORDER.reduce((acc, s) => acc + counts[s.key], 0)
  if (total === 0) return <div className={cn("h-1.5 rounded-full bg-muted", className)} />
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full", className)}>
          {ORDER.map((s) =>
            counts[s.key] > 0 ? (
              <div
                key={s.key}
                className={cn(
                  "h-full first:rounded-l-full last:rounded-r-full",
                  s.key === "absent" && pending ? "bg-muted-foreground/20" : s.className
                )}
                style={{ width: `${(counts[s.key] / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="grid gap-1">
        {ORDER.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-sm", s.className)} />
              {s.key === "absent" && pending ? "Sin registro" : STATUS_LABEL[s.key]}
            </span>
            <span className="tabular font-medium">{counts[s.key]}</span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}
