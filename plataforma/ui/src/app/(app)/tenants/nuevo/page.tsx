"use client"

import { BuildingsIcon, GitForkIcon, RocketLaunchIcon, StackIcon } from "@phosphor-icons/react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { toast } from "sonner"

import { Pagina } from "@/components/plataforma/pagina"
import { PlanTarjeta, precio } from "@/components/plataforma/plan-tarjeta"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { ENTORNOS, MOTORES } from "@/lib/formato"
import { cn } from "@/lib/utils"
import type { Opciones, Plan, Tenant } from "@/lib/tipos"

function identificador(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 20)
    .replace(/-+$/, "")
}

const DESCRIPCION_MOTOR: Record<string, string> = {
  terraform: "HCL declarativo · estado en S3",
  pulumi: "Python con el SDK de AWS · estado en S3",
}

function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: typeof BuildingsIcon
  titulo: string
  descripcion: string
  children: React.ReactNode
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icono weight="duotone" className="size-5 text-primary" /> {titulo}
        </CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}

function Formulario() {
  const router = useRouter()
  const inicial = useSearchParams().get("plan")
  const { data: planes } = useQuery({ queryKey: ["planes"], queryFn: () => api<Plan[]>("/planes") })
  const { data: opciones } = useQuery({ queryKey: ["opciones"], queryFn: () => api<Opciones>("/opciones") })

  const [institucion, setInstitucion] = useState("")
  const [id, setId] = useState("")
  const [idEditado, setIdEditado] = useState(false)
  const [correo, setCorreo] = useState("")
  const [region, setRegion] = useState("us-east-1")
  const [entorno, setEntorno] = useState("produccion")
  const [plan, setPlan] = useState<Plan["id"]>(
    inicial === "estandar" || inicial === "avanzado" ? inicial : "basico"
  )
  const [motor, setMotor] = useState("terraform")
  const [adminRegistro, setAdminRegistro] = useState("")
  const [adminNombre, setAdminNombre] = useState("")
  const [datosDemo, setDatosDemo] = useState(true)
  const elegido = planes?.find((p) => p.id === plan)

  const crear = useMutation({
    mutationFn: () =>
      api<Tenant>("/tenants", {
        method: "POST",
        json: {
          id,
          institucion,
          correo,
          region,
          entorno,
          plan,
          motor,
          admin_registro: adminRegistro,
          admin_nombre: adminNombre,
          datos_demo: datosDemo,
        },
      }),
    onSuccess: (tenant) => {
      toast.success(`Creando el tenant ${tenant.id}`)
      router.push(`/tenants/${tenant.id}`)
    },
  })

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        crear.mutate()
      }}
    >
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <StackIcon weight="duotone" className="size-5 text-primary" /> 1. Plan
        </h2>
        <div className="grid items-stretch gap-6 pt-3 md:grid-cols-3">
          {planes
            ? planes.map((p) => (
                <PlanTarjeta key={p.id} plan={p} seleccionado={plan === p.id} onSeleccionar={() => setPlan(p.id)} />
              ))
            : [0, 1, 2].map((i) => <Skeleton key={i} className="h-[440px] rounded-2xl" />)}
        </div>
      </section>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Seccion icono={BuildingsIcon} titulo="2. Institución" descripcion="Datos del tenant y de su administrador.">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="institucion">Nombre de la institución</FieldLabel>
              <Input
                id="institucion"
                required
                minLength={3}
                placeholder="Universidad Privada de Santa Cruz"
                value={institucion}
                onChange={(e) => {
                  setInstitucion(e.target.value)
                  if (!idEditado) setId(identificador(e.target.value))
                }}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="id">Identificador</FieldLabel>
                <Input
                  id="id"
                  required
                  pattern="[a-z][a-z0-9\-]{2,19}"
                  placeholder="upsa"
                  className="font-mono"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value)
                    setIdEditado(true)
                  }}
                />
                <FieldDescription>3 a 20 minúsculas, números o guiones.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="correo">Correo de contacto</FieldLabel>
                <Input
                  id="correo"
                  type="email"
                  required
                  placeholder="sistemas@upsa.edu.bo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="registro">Registro del administrador</FieldLabel>
                <Input
                  id="registro"
                  required
                  inputMode="numeric"
                  pattern="\d{6,12}"
                  placeholder="100200300"
                  className="font-mono"
                  value={adminRegistro}
                  onChange={(e) => setAdminRegistro(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nombre">Nombre del administrador</FieldLabel>
                <Input
                  id="nombre"
                  required
                  minLength={3}
                  placeholder="Jefatura de Sistemas"
                  value={adminNombre}
                  onChange={(e) => setAdminNombre(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
        </Seccion>

        <Seccion icono={GitForkIcon} titulo="3. Despliegue" descripcion="Dónde y con qué motor se aprovisiona.">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Región</FieldLabel>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(opciones?.regiones ?? ["us-east-1"]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Entorno</FieldLabel>
                <Select value={entorno} onValueChange={setEntorno}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(opciones?.entornos ?? ["produccion"]).map((e) => (
                      <SelectItem key={e} value={e}>
                        {ENTORNOS[e] ?? e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>Motor de aprovisionamiento</FieldLabel>
              <div className="grid items-stretch gap-3 sm:grid-cols-2">
                {(opciones?.motores ?? []).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMotor(m.id)}
                    className={cn(
                      "flex h-full flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:border-primary/60",
                      motor === m.id && "border-primary bg-primary/5 ring-2 ring-primary/30"
                    )}
                  >
                    <span className="font-semibold">{m.nombre}</span>
                    <span className="text-xs text-muted-foreground">{DESCRIPCION_MOTOR[m.id]}</span>
                  </button>
                ))}
              </div>
              <FieldDescription>Ambos motores crean exactamente los mismos recursos.</FieldDescription>
            </Field>
            <label className="flex items-center gap-2.5 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={datosDemo}
                onChange={(e) => setDatosDemo(e.target.checked)}
              />
              Cargar estudiantes y asistencia de ejemplo
            </label>
          </FieldGroup>
        </Seccion>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <div className="font-medium">
            {institucion || "Nueva institución"}
            {id && <span className="ml-2 font-mono text-muted-foreground">{id}</span>}
          </div>
          <div className="text-muted-foreground">
            Plan {elegido?.nombre ?? "—"} · {MOTORES[motor as keyof typeof MOTORES]} · {region}
            {elegido && ` · ~US$ ${precio(elegido)} por día`}
          </div>
          {crear.error && <FieldError className="mt-1">{crear.error.message}</FieldError>}
        </div>
        <Button type="submit" size="lg" className="h-10 px-5" disabled={crear.isPending}>
          {crear.isPending ? <Spinner /> : <RocketLaunchIcon />} Crear tenant
        </Button>
      </div>
    </form>
  )
}

export default function NuevoTenant() {
  return (
    <Pagina
      eyebrow="Tenants"
      titulo="Nuevo tenant"
      descripcion="Registre la institución, elija su plan y el motor que aprovisionará su propia copia de Presencia."
    >
      <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
        <Formulario />
      </Suspense>
    </Pagina>
  )
}
