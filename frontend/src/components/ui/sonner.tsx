"use client"

import { CheckCircleIcon, InfoIcon, SpinnerGapIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Notificaciones del sistema: tarjeta sobria con barra lateral de color por tipo,
 * ícono, título, descripción opcional y botón de cierre. Se muestran abajo a la derecha.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position="bottom-right"
      offset={24}
      gap={10}
      visibleToasts={4}
      duration={4500}
      closeButton
      icons={{
        success: <CheckCircleIcon weight="fill" className="size-[18px] text-primary" />,
        info: <InfoIcon weight="fill" className="size-[18px] text-primary" />,
        warning: <WarningIcon weight="fill" className="size-[18px] text-status-late" />,
        error: <XCircleIcon weight="fill" className="size-[18px] text-destructive" />,
        loading: <SpinnerGapIcon className="size-[18px] animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group/toast relative flex w-[min(380px,calc(100vw-32px))] items-start gap-3 overflow-hidden rounded-xl border bg-popover py-3.5 pr-10 pl-5 text-popover-foreground shadow-[0_12px_32px_-8px_rgb(0_0_0/0.18),0_2px_6px_-2px_rgb(0_0_0/0.08)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary data-[type=error]:before:bg-destructive data-[type=warning]:before:bg-status-late data-[type=loading]:before:bg-muted-foreground/40",
          icon: "mt-px flex size-5 shrink-0 items-center justify-center",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-sm leading-snug font-semibold",
          description: "text-[13px] leading-snug text-muted-foreground",
          closeButton:
            "absolute top-3 right-3 left-auto flex size-6 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground hover:opacity-100 [&_svg]:size-3.5",
          actionButton:
            "mt-2 h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground",
          cancelButton: "mt-2 h-7 rounded-md bg-muted px-2.5 text-xs font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
