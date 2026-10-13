"use client"

import { STATUS_META } from "@/components/attendance/status-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUS_LABEL } from "@/lib/format"
import type { AttendanceStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const OPTIONS: AttendanceStatus[] = ["present", "late", "excused", "absent"]

export function StatusSelect({
  value,
  onChange,
  disabled,
  placeholder = "Sin registro",
  recorded = true,
  className,
}: {
  value: AttendanceStatus
  onChange: (s: AttendanceStatus) => void
  disabled?: boolean
  placeholder?: string
  /** Si es falso, el select muestra "Sin registro" en lugar del estado calculado. */
  recorded?: boolean
  className?: string
}) {
  return (
    <Select
      value={recorded ? value : ""}
      onValueChange={(v) => onChange(v as AttendanceStatus)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className={cn("w-[150px]", className)} aria-label="Estado de asistencia">
        <SelectValue placeholder={<span className="text-muted-foreground">{placeholder}</span>} />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((s) => {
          const Icon = STATUS_META[s].icon
          return (
            <SelectItem key={s} value={s}>
              <Icon weight="fill" className={cn("size-4", STATUS_META[s].fg)} />
              {STATUS_LABEL[s]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
