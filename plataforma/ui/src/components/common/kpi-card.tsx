import type { Icon } from "@phosphor-icons/react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  hint,
  icon: IconCmp,
  loading,
  accent = false,
  children,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: Icon
  loading?: boolean
  accent?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden p-5",
        accent &&
          "border-transparent bg-[oklch(0.17_0.02_264)] text-white dark:border-border dark:bg-[oklch(0.22_0.03_264)]"
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-[13px] font-medium",
            accent ? "text-white/65" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            accent ? "bg-white/10 text-white" : "bg-accent text-accent-foreground"
          )}
        >
          <IconCmp weight="duotone" className="size-[18px]" />
        </div>
      </div>
      <div className="relative mt-3 text-3xl font-semibold tracking-tight tabular">
        {loading ? <Skeleton className="h-9 w-20" /> : value}
      </div>
      {hint && (
        <div
          className={cn("relative mt-1.5 text-xs", accent ? "text-white/55" : "text-muted-foreground")}
        >
          {loading ? <Skeleton className="h-4 w-32" /> : hint}
        </div>
      )}
      {children && <div className="relative mt-4">{children}</div>}
    </Card>
  )
}
