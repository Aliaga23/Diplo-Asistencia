import { CheckCircleIcon, ClockIcon, ShieldCheckIcon, XCircleIcon } from "@phosphor-icons/react/ssr"
import type { Icon } from "@phosphor-icons/react"

import { STATUS_LABEL } from "@/lib/format"
import type { AttendanceStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export const STATUS_META: Record<
  AttendanceStatus,
  { icon: Icon; className: string; dot: string; fg: string }
> = {
  present: {
    icon: CheckCircleIcon,
    className:
      "bg-status-present/10 text-status-present ring-status-present/25 dark:bg-status-present/15 dark:text-[oklch(0.78_0.12_255)]",
    dot: "bg-status-present",
    fg: "text-status-present",
  },
  late: {
    icon: ClockIcon,
    className:
      "bg-status-late/12 text-[oklch(0.52_0.13_62)] ring-status-late/30 dark:bg-status-late/15 dark:text-[oklch(0.8_0.13_75)]",
    dot: "bg-status-late",
    fg: "text-status-late",
  },
  absent: {
    icon: XCircleIcon,
    className:
      "bg-status-absent/10 text-status-absent ring-status-absent/25 dark:bg-status-absent/15 dark:text-[oklch(0.75_0.15_25)]",
    dot: "bg-status-absent",
    fg: "text-status-absent",
  },
  excused: {
    icon: ShieldCheckIcon,
    className:
      "bg-status-excused/10 text-[oklch(0.48_0.1_182)] ring-status-excused/25 dark:bg-status-excused/15 dark:text-[oklch(0.78_0.1_180)]",
    dot: "bg-status-excused",
    fg: "text-status-excused",
  },
}

export function StatusBadge({
  status,
  muted = false,
  className,
}: {
  status: AttendanceStatus
  /** Muestra la falta como "Sin registro" (sesión aún abierta). */
  muted?: boolean
  className?: string
}) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium ring-1 ring-inset",
        muted ? "bg-muted text-muted-foreground ring-border" : meta.className,
        className
      )}
    >
      <Icon weight="bold" className="size-3.5" />
      {muted ? "Sin registro" : STATUS_LABEL[status]}
    </span>
  )
}
