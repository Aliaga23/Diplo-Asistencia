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
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Presencia</span>
        {subtitle && (
          <span className="mt-1 text-[11px] font-medium tracking-wide text-current/60 uppercase">
            Control de asistencia
          </span>
        )}
      </div>
    </div>
  )
}
