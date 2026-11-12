"use client"

import { BellRingingIcon, ChartLineIcon, CheckCircleIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { EstadoOperacionBadge } from "@/components/plataforma/estado"
import { Pagina } from "@/components/plataforma/pagina"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { TIPOS_OPERACION, duracion, fecha, hace } from "@/lib/formato"
import type { Alerta, Operacion } from "@/lib/tipos"

export default function Eventos() {
  const { data: alertas } = useQuery({
    queryKey: ["alertas"],
    queryFn: () => api<Alerta[]>("/alertas"),
    refetchInterval: 15_000,
  })
  const { data: eventos } = useQuery({
    queryKey: ["eventos"],
    queryFn: () => api<Operacion[]>("/eventos"),
    refetchInterval: 5_000,
  })

  return (
    <Pagina
      eyebrow="Operación"
      titulo="Alertas y eventos"
      descripcion="Alertas de Grafana sobre la salud de los tenants y últimas operaciones de la plataforma."
      acciones={
        <Button asChild variant="outline">
          <a href="http://localhost:3002/d/salud-tenants" target="_blank" rel="noreferrer">
            <ChartLineIcon /> Abrir el tablero
          </a>
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRingingIcon /> Alertas activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!alertas?.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircleIcon className="text-emerald-600" /> Sin alertas: todos los tenants responden.
            </p>
          ) : (
            <ul className="divide-y">
              {alertas.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">
                      {a.nombre}
                      {a.tenant && (
                        <>
                          {" · "}
                          <Link href={`/tenants/${a.tenant}`} className="font-mono text-primary hover:underline">
                            {a.tenant}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{a.resumen}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className={a.estado.toLowerCase().startsWith("pend") ? "text-amber-600" : "text-red-600"}>
                      {a.estado.toLowerCase().startsWith("pend") ? "Pendiente" : "Disparada"}
                    </div>
                    <div className="text-muted-foreground">{fecha(a.desde)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Hora</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead className="pr-6">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos?.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-6 whitespace-nowrap">
                    {fecha(o.creada_en)}
                    <div className="text-xs text-muted-foreground">{hace(o.creada_en)}</div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/tenants/${o.tenant_id}`} className="font-mono text-primary hover:underline">
                      {o.tenant_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    #{o.id} {TIPOS_OPERACION[o.tipo]}
                  </TableCell>
                  <TableCell>
                    <EstadoOperacionBadge estado={o.estado} />
                  </TableCell>
                  <TableCell>{duracion(o.iniciada_en, o.terminada_en)}</TableCell>
                  <TableCell className="max-w-md pr-6 text-sm whitespace-normal text-muted-foreground">
                    {o.error ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Pagina>
  )
}
