"use client"

import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { startIntro, type IntroEngine } from "@/components/brand/intro-engine"

interface IntroCtx {
  /** Reproduce la intro y, durante la fase de cenizas, navega al destino. */
  play: (destination: string) => void
}

const Ctx = createContext<IntroCtx | null>(null)

export function useIntro() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useIntro debe usarse dentro de IntroProvider")
  return ctx
}

/**
 * Montado en la raíz para que la animación sobreviva al cambio de ruta:
 * la pantalla negra se desmorona en cenizas sobre la página de destino ya cargada.
 */
export function IntroProvider({ children }: { children: React.ReactNode }) {
  const [destination, setDestination] = useState<string | null>(null)
  const play = useCallback((d: string) => setDestination(d), [])
  return (
    <Ctx.Provider value={{ play }}>
      {children}
      {destination && (
        <IntroOverlay destination={destination} onDone={() => setDestination(null)} />
      )}
    </Ctx.Provider>
  )
}

function IntroOverlay({ destination, onDone }: { destination: string; onDone: () => void }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<IntroEngine | null>(null)
  const navigatedRef = useRef(false)

  useEffect(() => {
    router.prefetch(destination)
    const navigate = () => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      router.replace(destination)
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || !canvasRef.current) {
      navigate()
      const t = setTimeout(onDone, 400)
      return () => clearTimeout(t)
    }
    engineRef.current = startIntro(canvasRef.current, {
      onNavigate: navigate,
      onDone: () => {
        navigate()
        onDone()
      },
      onFirstFrame: () => {
        if (containerRef.current) containerRef.current.style.background = "transparent"
      },
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") engineRef.current?.skip()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      engineRef.current?.stop()
    }
    // La animación se inicia una sola vez por reproducción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] cursor-default select-none"
      style={{ background: "#04060b" }}
      role="presentation"
      aria-label="Animación de bienvenida"
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
      <button
        type="button"
        onClick={() => engineRef.current?.skip()}
        className="absolute right-6 bottom-6 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        Saltar
      </button>
    </div>,
    document.body
  )
}
