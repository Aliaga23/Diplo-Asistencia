"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { api } from "@/lib/api"
import type { LineaLog, Operacion } from "@/lib/tipos"
import { cn } from "@/lib/utils"

function tono(texto: string) {
  if (/^ERROR|Error:|error:/.test(texto)) return "text-red-400"
  if (/^== /.test(texto)) return "text-sky-300 font-semibold"
  if (/^\$ /.test(texto)) return "text-zinc-500"
  if (/Advertencia|Warning/i.test(texto)) return "text-amber-300"
  if (/Apply complete|Listo\.|La aplicación responde|Resources: .* created|Sin secretos/.test(texto))
    return "text-emerald-400"
  return "text-zinc-200"
}

export function LogOperacion({ operacion }: { operacion: Operacion }) {
  const caja = useRef<HTMLDivElement>(null)
  const pegado = useRef(true)
  const enCurso = operacion.estado === "pendiente" || operacion.estado === "ejecutando"

  const { data: lineas = [] } = useQuery({
    queryKey: ["log", operacion.id],
    queryFn: () => api<LineaLog[]>(`/operaciones/${operacion.id}/log`),
    refetchInterval: enCurso ? 2_000 : false,
  })

  useEffect(() => {
    if (pegado.current && caja.current) caja.current.scrollTop = caja.current.scrollHeight
  }, [lineas])

  return (
    <div
      ref={caja}
      onScroll={(e) => {
        const el = e.currentTarget
        pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
      className="min-h-[480px] flex-1 basis-0 overflow-y-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed"
    >
      {lineas.length === 0 && (
        <div className="text-zinc-500">{enCurso ? "Esperando al worker..." : "Esta operación no tiene log."}</div>
      )}
      {lineas.map((l) => (
        <div key={l.id} className={cn("break-words whitespace-pre-wrap", tono(l.texto))}>
          {l.texto || " "}
        </div>
      ))}
      {enCurso && <div className="mt-1 animate-pulse text-zinc-500">▌</div>}
    </div>
  )
}
