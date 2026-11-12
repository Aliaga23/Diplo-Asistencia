"use client"

import { MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { EstadoTenantBadge } from "@/components/plataforma/estado"
import { Pagina } from "@/components/plataforma/pagina"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { ENTORNOS, ESTADOS_TENANT, MOTORES, PLANES, hace } from "@/lib/formato"
import type { Tenant } from "@/lib/tipos"

const TODOS = "todos"

function Filtro({
  valor,
  onChange,
  opciones,
  etiqueta,
}: {
  valor: string
  onChange: (v: string) => void
  opciones: Record<string, string>
  etiqueta: string
}) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{etiqueta}</SelectItem>
        {Object.entries(opciones).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EditarNombre({ tenant, onCerrar }: { tenant: Tenant; onCerrar: () => void }) {
  const cliente = useQueryClient()
  const [nombre, setNombre] = useState(tenant.institucion)
  const guardar = useMutation({
    mutationFn: () => api<Tenant>(`/tenants/${tenant.id}`, { method: "PATCH", json: { institucion: nombre } }),
    onSuccess: () => {
      toast.success("Nombre actualizado")
      cliente.invalidateQueries({ queryKey: ["tenants"] })
      onCerrar()
    },
  })
  return (
    <Modal open onOpenChange={(abierto) => !abierto && onCerrar()} size="sm">
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault()
          guardar.mutate()
        }}
      >
        <ModalHeader
          title="Editar nombre"
          description={`El identificador ${tenant.id} y su infraestructura no cambian.`}
          icon={PencilSimpleIcon}
        />
        <ModalBody>
          <Field>
            <FieldLabel htmlFor="nombre">Nombre de la institución</FieldLabel>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} minLength={3} required />
            {guardar.error && <FieldError>{guardar.error.message}</FieldError>}
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            Guardar
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

export default function Tenants() {
  const [nombre, setNombre] = useState("")
  const [estado, setEstado] = useState(TODOS)
  const [plan, setPlan] = useState(TODOS)
  const [entorno, setEntorno] = useState(TODOS)
  const [editando, setEditando] = useState<Tenant | null>(null)

  const filtros = new URLSearchParams()
  if (nombre.trim()) filtros.set("nombre", nombre.trim())
  if (estado !== TODOS) filtros.set("estado", estado)
  if (plan !== TODOS) filtros.set("plan", plan)
  if (entorno !== TODOS) filtros.set("entorno", entorno)

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants", filtros.toString()],
    queryFn: () => api<Tenant[]>(`/tenants?${filtros}`),
    refetchInterval: 5_000,
  })

  const estados = Object.fromEntries(Object.entries(ESTADOS_TENANT).map(([k, v]) => [k, v.texto]))

  return (
    <Pagina
      eyebrow="Tenants"
      titulo="Instituciones"
      descripcion="Cada tenant es una copia aislada de Presencia con su propio servidor, base de datos y URL."
      acciones={
        <Button asChild size="lg">
          <Link href="/tenants/nuevo">
            <PlusIcon /> Nuevo tenant
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:w-80">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o identificador"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <Filtro valor={estado} onChange={setEstado} opciones={estados} etiqueta="Todos los estados" />
        <Filtro valor={plan} onChange={setPlan} opciones={PLANES} etiqueta="Todos los planes" />
        <Filtro valor={entorno} onChange={setEntorno} opciones={ENTORNOS} etiqueta="Todos los entornos" />
        <span className="text-sm text-muted-foreground sm:ml-auto sm:pr-1">
          {tenants ? `${tenants.length} ${tenants.length === 1 ? "institución" : "instituciones"}` : ""}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !tenants?.length ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyTitle>No hay tenants</EmptyTitle>
            <EmptyDescription>Crea el primero o cambia los filtros.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card [&_td]:py-3 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_th]:h-11 [&_th]:bg-muted/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institución</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Motor</TableHead>
                <TableHead>Entorno</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/tenants/${t.id}`} className="font-medium hover:underline">
                      {t.institucion}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{t.id}</div>
                  </TableCell>
                  <TableCell>
                    <EstadoTenantBadge estado={t.estado} />
                  </TableCell>
                  <TableCell>{PLANES[t.plan]}</TableCell>
                  <TableCell>{MOTORES[t.motor]}</TableCell>
                  <TableCell>{ENTORNOS[t.entorno] ?? t.entorno}</TableCell>
                  <TableCell>
                    {t.url && t.estado === "activo" ? (
                      <a href={t.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                        {t.url.replace("http://", "")}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{hace(t.creado_en)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Editar nombre" onClick={() => setEditando(t)}>
                      <PencilSimpleIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editando && <EditarNombre tenant={editando} onCerrar={() => setEditando(null)} />}
    </Pagina>
  )
}
