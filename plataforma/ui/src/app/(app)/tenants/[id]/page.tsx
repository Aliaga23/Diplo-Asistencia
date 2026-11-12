"use client"

import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  ChartLineIcon,
  EyeIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { EstadoOperacionBadge, EstadoTenantBadge } from "@/components/plataforma/estado"
import { LogOperacion } from "@/components/plataforma/log-operacion"
import { Pagina } from "@/components/plataforma/pagina"
import { useCrumb } from "@/components/shell/breadcrumb-store"
import { GRAFANA_URL as GRAFANA } from "@/components/shell/nav"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { ENTORNOS, MOTORES, PLANES, TIPOS_OPERACION, duracion, fecha } from "@/lib/formato"
import type { Operacion, Recurso, Tenant } from "@/lib/tipos"
import { cn } from "@/lib/utils"


const VERSIONES: Record<string, string> = {
  plataforma: "Plataforma",
  app: "Versión de la app",
  ami: "Imagen (AMI)",
  motor: "Motor",
  version_motor: "Versión del motor",
  plantillas: "Huella de las plantillas",
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="text-sm font-medium break-words">{children}</div>
    </div>
  )
}

function Credenciales({ tenant }: { tenant: Tenant }) {
  const [ver, setVer] = useState(false)
  const { data, error, isFetching } = useQuery({
    queryKey: ["credenciales", tenant.id],
    queryFn: () => api<{ registro: string; password: string }>(`/tenants/${tenant.id}/credenciales`),
    enabled: ver,
  })
  return (
    <div className="space-y-2">
      <Dato etiqueta="Administrador del tenant">
        {tenant.admin_nombre}
        <span className="block font-mono text-xs font-normal text-muted-foreground">
          Registro {tenant.admin_registro}
        </span>
      </Dato>
      {!ver ? (
        <Button variant="outline" size="sm" onClick={() => setVer(true)}>
          <EyeIcon /> Ver contraseña inicial
        </Button>
      ) : isFetching ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error.message}</p>
      ) : (
        <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">{data?.password}</code>
      )}
    </div>
  )
}

function Eliminar({ tenant, onCerrar }: { tenant: Tenant; onCerrar: () => void }) {
  const cliente = useQueryClient()
  const [confirmacion, setConfirmacion] = useState("")
  const { data: recursos, isLoading } = useQuery({
    queryKey: ["recursos", tenant.id],
    queryFn: () => api<Recurso[]>(`/tenants/${tenant.id}/recursos`),
  })
  const eliminar = useMutation({
    mutationFn: () =>
      api<Operacion>(`/tenants/${tenant.id}?confirmacion=${encodeURIComponent(confirmacion)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Eliminación en curso")
      cliente.invalidateQueries({ queryKey: ["tenant", tenant.id] })
      onCerrar()
    },
  })
  return (
    <Modal open onOpenChange={(abierto) => !abierto && onCerrar()} size="lg">
      <ModalHeader
        title={`Eliminar ${tenant.institucion}`}
        description="Se borran los servidores, la base de datos con todos sus datos, la red y los secretos. No se puede deshacer."
        icon={TrashIcon}
      />
      <ModalBody className="space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-medium">Recursos que se eliminarán en AWS</div>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
              {recursos?.map((r) => (
                <li key={r.arn} className="flex justify-between gap-4 px-3 py-2">
                  <span className="text-muted-foreground">{r.tipo}</span>
                  <span className="truncate font-mono text-xs">{r.nombre}</span>
                </li>
              ))}
              {!recursos?.length && <li className="px-3 py-2 text-muted-foreground">No se encontraron recursos.</li>}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            También se borran el rol IAM del tenant y el estado de {MOTORES[tenant.motor]}.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="confirmacion">
            Escribe <span className="font-mono">{tenant.id}</span> para confirmar
          </FieldLabel>
          <Input id="confirmacion" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </Field>
        {eliminar.error && <p className="text-sm text-destructive">{eliminar.error.message}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          disabled={confirmacion !== tenant.id || eliminar.isPending}
          onClick={() => eliminar.mutate()}
        >
          <TrashIcon /> Eliminar tenant
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default function DetalleTenant() {
  const { id } = useParams<{ id: string }>()
  const cliente = useQueryClient()
  const [eliminando, setEliminando] = useState(false)
  const [seleccionada, setSeleccionada] = useState<number | null>(null)

  const { data: tenant, error } = useQuery({
    queryKey: ["tenant", id],
    queryFn: () => api<Tenant>(`/tenants/${id}`),
    refetchInterval: 3_000,
  })
  const { data: operaciones } = useQuery({
    queryKey: ["operaciones", id],
    queryFn: () => api<Operacion[]>(`/tenants/${id}/operaciones`),
    refetchInterval: 3_000,
  })

  useCrumb(`/tenants/${id}`, tenant?.institucion)

  const accion = useMutation({
    mutationFn: (ruta: string) => api<Operacion>(`/tenants/${id}/${ruta}`, { method: "POST" }),
    onSuccess: (op) => {
      toast.success(`${TIPOS_OPERACION[op.tipo]}: operación #${op.id} en cola`)
      setSeleccionada(null)
      cliente.invalidateQueries({ queryKey: ["tenant", id] })
      cliente.invalidateQueries({ queryKey: ["operaciones", id] })
    },
    onError: (e) => toast.error(e.message),
  })

  if (error) {
    return (
      <Pagina titulo="Tenant no encontrado">
        <Button asChild variant="outline">
          <Link href="/tenants">Volver a la lista</Link>
        </Button>
      </Pagina>
    )
  }
  if (!tenant) {
    return (
      <Pagina titulo={<Skeleton className="h-8 w-64" />}>
        <Skeleton className="h-96 rounded-xl" />
      </Pagina>
    )
  }

  const ultima = tenant.ultima_operacion
  const operacion = operaciones?.find((o) => o.id === seleccionada) ?? operaciones?.[0] ?? ultima
  const ocupado = ultima?.estado === "pendiente" || ultima?.estado === "ejecutando"

  return (
    <Pagina
      eyebrow="Tenant"
      titulo={
        <span className="flex flex-wrap items-center gap-3">
          {tenant.institucion} <EstadoTenantBadge estado={tenant.estado} />
        </span>
      }
      descripcion={
        <span className="font-mono">
          {tenant.id} · {tenant.region}
        </span>
      }
      acciones={
        <>
          {tenant.url && tenant.estado === "activo" && (
            <Button asChild>
              <a href={tenant.url} target="_blank" rel="noreferrer">
                <ArrowSquareOutIcon /> Abrir la app
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <a href={`${GRAFANA}?var-tenant=${tenant.id}`} target="_blank" rel="noreferrer">
              <ChartLineIcon /> Salud en Grafana
            </a>
          </Button>
          {tenant.estado === "activo" && (
            <Button variant="outline" disabled={ocupado || accion.isPending} onClick={() => accion.mutate("suspender")}>
              <PauseIcon /> Suspender
            </Button>
          )}
          {tenant.estado === "suspendido" && (
            <Button variant="outline" disabled={ocupado || accion.isPending} onClick={() => accion.mutate("reanudar")}>
              <PlayIcon /> Reanudar
            </Button>
          )}
          {ultima?.estado === "fallida" && (
            <Button variant="outline" disabled={accion.isPending} onClick={() => accion.mutate("reintentar")}>
              <ArrowClockwiseIcon /> Reintentar
            </Button>
          )}
          {tenant.estado !== "eliminado" && (
            <Button variant="destructive" disabled={ocupado} onClick={() => setEliminando(true)}>
              <TrashIcon /> Eliminar
            </Button>
          )}
        </>
      }
    >
      {ultima?.estado === "fallida" && (
        <Alert variant="destructive">
          <WarningIcon />
          <AlertTitle>Falló la operación «{TIPOS_OPERACION[ultima.tipo]}»</AlertTitle>
          <AlertDescription>
            {ultima.error} Puedes reintentarla: el motor parte del estado guardado y no duplica recursos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-stretch gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dato etiqueta="URL">
                {tenant.url ? (
                  <a href={tenant.url} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline">
                    {tenant.url}
                  </a>
                ) : (
                  "Se asigna al crear"
                )}
              </Dato>
              <div className="grid grid-cols-2 gap-4">
                <Dato etiqueta="Plan">{PLANES[tenant.plan]}</Dato>
                <Dato etiqueta="Motor">{MOTORES[tenant.motor]}</Dato>
                <Dato etiqueta="Entorno">{ENTORNOS[tenant.entorno] ?? tenant.entorno}</Dato>
                <Dato etiqueta="Creado">{fecha(tenant.creado_en)}</Dato>
              </div>
              <Dato etiqueta="Contacto">{tenant.correo}</Dato>
              {!!tenant.salidas.instancias?.length && (
                <Dato etiqueta="Servidores">
                  <span className="font-mono text-xs">{tenant.salidas.instancias.join(", ")}</span>
                </Dato>
              )}
              {tenant.salidas.rds && (
                <Dato etiqueta="Base RDS">
                  <span className="font-mono text-xs">{tenant.salidas.rds}</span>
                </Dato>
              )}
              {tenant.estado !== "eliminado" && tenant.estado !== "creando" && <Credenciales tenant={tenant} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {operaciones?.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSeleccionada(o.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                    operacion?.id === o.id && "bg-muted"
                  )}
                >
                  <span>
                    <span className="font-medium">
                      #{o.id} {TIPOS_OPERACION[o.tipo]}
                    </span>
                    {o.reintento_de && <span className="text-muted-foreground"> · reintento de #{o.reintento_de}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {fecha(o.creada_en)} · {duracion(o.iniciada_en, o.terminada_en)}
                    </span>
                  </span>
                  <EstadoOperacionBadge estado={o.estado} />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {operacion && (
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>
                  Log de la operación #{operacion.id} · {TIPOS_OPERACION[operacion.tipo]}
                </CardTitle>
                <EstadoOperacionBadge estado={operacion.estado} />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <LogOperacion operacion={operacion} />
              </CardContent>
            </Card>
          )}
          {operacion && Object.keys(operacion.versiones).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Versiones usadas en este despliegue</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {Object.entries(operacion.versiones).map(([clave, valor]) => (
                  <Dato key={clave} etiqueta={VERSIONES[clave] ?? clave}>
                    <span className="font-mono text-xs">{String(valor)}</span>
                  </Dato>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {eliminando && <Eliminar tenant={tenant} onCerrar={() => setEliminando(false)} />}
    </Pagina>
  )
}
