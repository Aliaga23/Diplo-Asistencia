"use client"

import { DatabaseIcon, GitCommitIcon, HeartbeatIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Estado {
  institucion: string
  api: boolean
  base_datos: boolean
  latencia_bd_ms: number | null
  version: string
}

function Indicador({ ok, texto, detalle }: { ok: boolean; texto: string; detalle?: string }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={cn("size-2 rounded-full", ok ? "bg-emerald-500" : "bg-red-500")} />
      <span className="font-medium">{texto}</span>
      <span className="text-muted-foreground">{ok ? (detalle ?? "Operativa") : "Sin respuesta"}</span>
    </span>
  )
}

/** Estado de los servicios de la institución, para su administrador. */
export function EstadoServicios() {
  const { data, isError } = useQuery({
    queryKey: ["sistema", "estado"],
    queryFn: () => api.get<Estado>("/sistema/estado"),
    refetchInterval: 30_000,
  })

  return (
    <Card className="mb-4 flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <HeartbeatIcon weight="duotone" className="size-5 text-primary" />
        Estado de los servicios
      </span>
      {data ? (
        <>
          <Indicador ok={data.api} texto="API" />
          <span className="flex items-center gap-2">
            <DatabaseIcon className="size-4 text-muted-foreground" />
            <Indicador
              ok={data.base_datos}
              texto="Base de datos"
              detalle={data.latencia_bd_ms !== null ? `${data.latencia_bd_ms} ms` : undefined}
            />
          </span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
            <GitCommitIcon className="size-4" />
            Versión <span className="font-mono text-foreground">{data.version}</span>
          </span>
        </>
      ) : isError ? (
        <Indicador ok={false} texto="API" />
      ) : (
        <Skeleton className="h-5 w-72" />
      )}
    </Card>
  )
}
