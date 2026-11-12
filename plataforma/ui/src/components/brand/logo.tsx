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
      <path d="M8 12.5 16 8l8 4.5-8 4.5-8-4.5Z" fill="white" />
      <path d="m8 16.5 8 4.5 8-4.5" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.85" />
      <path d="m8 20.5 8 4.5 8-4.5" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.6" />
    </svg>
  )
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Presencia Cloud</span>
        {subtitle && (
          <span className="mt-1 text-[11px] font-medium tracking-wide text-current/60 uppercase">
            Plataforma de tenants
          </span>
        )}
      </div>
    </div>
  )
}
