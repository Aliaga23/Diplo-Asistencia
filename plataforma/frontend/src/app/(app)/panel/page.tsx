"use client"

import {
  BellRingingIcon,
  BuildingsIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  PauseCircleIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { KpiCard } from "@/components/common/kpi-card"
import { EstadoOperacionBadge, EstadoTenantBadge } from "@/components/plataforma/estado"
import { Pagina } from "@/components/plataforma/pagina"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { MOTORES, PLANES, TIPOS_OPERACION, hace } from "@/lib/formato"
import type { Alerta, Operacion, Plan, Tenant } from "@/lib/tipos"

const dinero = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Panel() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants", ""],
    queryFn: () => api<Tenant[]>("/tenants"),
    refetchInterval: 5_000,
  })
  const { data: planes } = useQuery({ queryKey: ["planes"], queryFn: () => api<Plan[]>("/planes") })
  const { data: eventos } = useQuery({
    queryKey: ["eventos"],
    queryFn: () => api<Operacion[]>("/eventos"),
    refetchInterval: 5_000,
  })
  const { data: alertas } = useQuery({
    queryKey: ["alertas"],
    queryFn: () => api<Alerta[]>("/alertas"),
    refetchInterval: 15_000,
  })

  const lista = tenants ?? []
  const activos = lista.filter((t) => t.estado === "activo")
  const suspendidos = lista.filter((t) => t.estado === "suspendido")
  const conProblemas = lista.filter((t) => t.estado === "error")
  const costo = activos.reduce((suma, t) => suma + (planes?.find((p) => p.id === t.plan)?.costo_dia_usd ?? 0), 0)

  return (
    <Pagina
      eyebrow="Consola"
      titulo="Panel de la plataforma"
      descripcion="Estado de los tenants de todas las instituciones, costo estimado y actividad reciente."
      acciones={
        <Button asChild size="lg">
          <Link href="/tenants/nuevo">
            <PlusIcon /> Nuevo tenant
          </Link>
        </Button>
      }
    >
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          accent
          label="Tenants activos"
          value={activos.length}
          hint={`${lista.length} instituciones registradas`}
          icon={CheckCircleIcon}
          loading={isLoading}
        />
        <KpiCard
          label="Suspendidos"
          value={suspendidos.length}
          hint="Servidores apagados, datos conservados"
          icon={PauseCircleIcon}
          loading={isLoading}
        />
        <KpiCard
          label="Con error"
          value={conProblemas.length}
          hint={conProblemas.length ? "Revise y reintente la operación" : "Sin operaciones fallidas"}
          icon={WarningCircleIcon}
          loading={isLoading}
        />
        <KpiCard
          label="Costo estimado por día"
          value={`US$ ${dinero(costo)}`}
          hint="Tenants activos, us-east-1"
          icon={CurrencyDollarIcon}
          loading={isLoading || !planes}
        />
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="h-full gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-4">
            <CardTitle className="flex items-center gap-2">
              <BuildingsIcon weight="duotone" className="size-5 text-primary" /> Instituciones
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/tenants">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {lista.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                href={`/tenants/${t.id}`}
                className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.institucion}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {t.id} · {PLANES[t.plan]} · {MOTORES[t.motor]}
                  </div>
                </div>
                <EstadoTenantBadge estado={t.estado} />
              </Link>
            ))}
            {!lista.length && !isLoading && (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Todavía no hay tenants.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid h-full gap-6">
          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between border-b py-4">
              <CardTitle className="flex items-center gap-2">
                <BellRingingIcon weight="duotone" className="size-5 text-primary" /> Alertas activas
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/eventos">Ver detalle</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-6 py-4">
              {alertas?.length ? (
                <ul className="space-y-3">
                  {alertas.slice(0, 3).map((a, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium text-red-600 dark:text-red-400">{a.nombre}</div>
                        <div className="text-xs text-muted-foreground">{a.resumen}</div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{hace(a.desde)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircleIcon weight="fill" className="size-4 text-emerald-500" /> Todos los tenants responden.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {eventos?.slice(0, 5).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{TIPOS_OPERACION[o.tipo]}</span>{" "}
                    <Link href={`/tenants/${o.tenant_id}`} className="font-mono text-primary hover:underline">
                      {o.tenant_id}
                    </Link>
                    <div className="text-xs text-muted-foreground">{hace(o.creada_en)}</div>
                  </div>
                  <EstadoOperacionBadge estado={o.estado} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Pagina>
  )
}
