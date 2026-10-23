"use client"

/**
 * Modal propio del sistema (no usa el Dialog de shadcn/Radix).
 * - Se monta en un portal sobre <body>, centrado, y bloquea el scroll de fondo.
 * - Estructura en columna: encabezado fijo, cuerpo con scroll propio y pie fijo.
 * - Atrapa el foco (Tab / Shift+Tab), cierra con Escape o clic en el fondo
 *   y devuelve el foco al elemento que lo abrió.
 * - Anima la entrada y la salida; se desmonta al terminar la animación.
 */

import { XIcon } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SIZES = {
  sm: "sm:max-w-[480px]",
  md: "sm:max-w-[640px]",
  lg: "sm:max-w-[820px]",
  xl: "sm:max-w-[1080px]",
} as const

interface ModalCtx {
  close: () => void
  titleId: string
  descId: string
}

const Ctx = createContext<ModalCtx | null>(null)

function useModal() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("Los subcomponentes de Modal deben usarse dentro de <Modal>")
  return ctx
}

export function Modal({
  open,
  onOpenChange,
  size = "md",
  dismissible = true,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: keyof typeof SIZES
  /** Si es falso, Escape y el clic en el fondo no cierran el modal. */
  dismissible?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [present, setPresent] = useState(open)
  // Ajuste de estado durante el render (patrón recomendado por React): monta al abrir.
  if (open && !present) setPresent(true)

  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  // Foco inicial, trampa de foco, Escape y restauración del foco.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(`[data-slot=modal-body] :is(${FOCUSABLE})`)
    ;(first ?? panel)?.focus({ preventScroll: true })

    function onKey(e: KeyboardEvent) {
      const p = panelRef.current
      if (!p) return
      // Ignora teclas originadas en capas flotantes (selects, popovers) fuera del panel.
      if (e.target instanceof Node && !p.contains(e.target) && e.target !== document.body) return
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation()
        close()
      }
      if (e.key === "Tab") {
        const items = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null
        )
        if (items.length === 0) {
          e.preventDefault()
          return
        }
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open, dismissible, close])

  // Respaldo: si la animación de salida no se dispara (p. ej. movimiento reducido), desmonta igual.
  useEffect(() => {
    if (open || !present) return
    const t = setTimeout(() => setPresent(false), 300)
    return () => clearTimeout(t)
  }, [open, present])

  // Bloqueo de scroll del documento mientras el modal está montado.
  useEffect(() => {
    if (!present) return
    const { overflow, paddingRight } = document.body.style
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = "hidden"
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [present])

  if (!present || typeof document === "undefined") return null

  return createPortal(
    <Ctx.Provider value={{ close, titleId, descId }}>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
        onMouseDown={(e) => {
          if (dismissible && e.target === e.currentTarget) close()
        }}
      >
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 -z-10 bg-[oklch(0.08_0.015_264/0.62)] backdrop-blur-[2px]",
            open ? "animate-in fade-in duration-200" : "animate-out fade-out duration-150 fill-mode-forwards"
          )}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          data-slot="modal"
          onAnimationEnd={(e) => {
            if (!open && e.target === e.currentTarget) setPresent(false)
          }}
          className={cn(
            "relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card text-card-foreground shadow-[0_24px_80px_-12px_rgb(0_0_0/0.35)] outline-none sm:max-h-[min(88svh,920px)] sm:rounded-2xl",
            open
              ? "animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200"
              : "animate-out fade-out zoom-out-95 slide-out-to-bottom-4 duration-150 fill-mode-forwards",
            SIZES[size],
            className
          )}
        >
          {children}
        </div>
      </div>
    </Ctx.Provider>,
    document.body
  )
}

export function ModalHeader({
  title,
  description,
  icon: IconCmp,
  actions,
  hideClose = false,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: Icon
  actions?: React.ReactNode
  hideClose?: boolean
  className?: string
}) {
  const { close, titleId, descId } = useModal()
  return (
    <header className={cn("flex shrink-0 items-start gap-4 border-b px-6 py-5 sm:px-8 sm:py-6", className)}>
      {IconCmp && (
        <div
          data-slot="modal-icon"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/60 text-primary"
        >
          <IconCmp weight="duotone" className="size-[22px]" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <h2 id={titleId} className="text-lg leading-tight font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <div id={descId} className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-0.5">{actions}</div>}
      {!hideClose && (
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-[18px]" />
        </button>
      )}
    </header>
  )
}

export function ModalBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7", className)}
      {...props}
    />
  )
}

export function ModalFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <footer
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8 [&_button]:min-w-24",
        className
      )}
      {...props}
    />
  )
}
