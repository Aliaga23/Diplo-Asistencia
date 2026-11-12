import {
  ArrowRightIcon,
  ChartLineUpIcon,
  CloudArrowUpIcon,
  GitForkIcon,
  LockKeyIcon,
  PauseCircleIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/ssr"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { PlanTarjeta } from "@/components/plataforma/plan-tarjeta"
import { Button } from "@/components/ui/button"
import { API_URL, TOKEN_COOKIE, tokenVigente } from "@/lib/sesion"
import type { Plan } from "@/lib/tipos"

export const metadata: Metadata = { title: "Presencia Cloud · Planes" }
export const dynamic = "force-dynamic"

const CARACTERISTICAS = [
  {
    icono: CloudArrowUpIcon,
    titulo: "Aprovisionamiento automático",
    texto: "Red, servidores y base de datos propios en minutos, sin pasos manuales.",
  },
  {
    icono: GitForkIcon,
    titulo: "Terraform o Pulumi",
    texto: "Elija el motor de infraestructura como código: ambos crean lo mismo.",
  },
  {
    icono: ShieldCheckIcon,
    titulo: "Aislamiento total",
    texto: "Cada institución en su propia VPC, con su base y sus credenciales.",
  },
  {
    icono: ChartLineUpIcon,
    titulo: "Monitoreo con Grafana",
    texto: "Salud por tenant y alertas de caída, CPU, disco y errores.",
  },
  {
    icono: PauseCircleIcon,
    titulo: "Ciclo de vida completo",
    texto: "Suspenda para ahorrar, reanude en la misma URL o elimine con confirmación.",
  },
  {
    icono: LockKeyIcon,
    titulo: "Seguridad desde el inicio",
    texto: "Escaneo de secretos antes de cada despliegue y contraseñas cifradas en SSM.",
  },
]

const PASOS = [
  { n: "01", titulo: "Elija el plan", texto: "Según el tamaño de la institución." },
  { n: "02", titulo: "Registre la institución", texto: "Nombre, identificador, contacto y administrador." },
  { n: "03", titulo: "Siga el despliegue", texto: "Log en vivo hasta que la app responde." },
  { n: "04", titulo: "Entregue la URL", texto: "Con el usuario y la contraseña inicial del admin." },
]

async function planes(): Promise<Plan[]> {
  try {
    const res = await fetch(`${API_URL}/planes`, { cache: "no-store" })
    return res.ok ? await res.json() : []
  } catch {
    return []
  }
}

export default async function Landing() {
  const [catalogo, galletas] = await Promise.all([planes(), cookies()])
  const conSesion = tokenVigente(galletas.get(TOKEN_COOKIE)?.value)
  const destino = conSesion ? "/panel" : "/login"
  const textoDestino = conSesion ? "Ir a la consola" : "Ingresar a la consola"

  return (
    <div className="min-h-svh bg-background">
      <section className="relative overflow-hidden bg-[oklch(0.13_0.015_264)] text-white">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_75%)]" />
        <div className="absolute -top-40 -left-32 size-[560px] rounded-full bg-[oklch(0.55_0.22_263)] opacity-30 blur-[140px]" />
        <div className="absolute -right-24 top-40 size-[420px] rounded-full bg-[oklch(0.6_0.18_240)] opacity-20 blur-[120px]" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <Logo className="[&_span:last-child]:text-white/55" />
          <nav className="flex items-center gap-2">
            <a href="#planes" className="hidden rounded-md px-3 py-1.5 text-sm text-white/70 hover:text-white sm:block">
              Planes
            </a>
            <a href="#como" className="hidden rounded-md px-3 py-1.5 text-sm text-white/70 hover:text-white sm:block">
              Cómo funciona
            </a>
            <Button asChild size="lg" className="bg-white text-[oklch(0.13_0.015_264)] hover:bg-white/90">
              <Link href={destino}>{textoDestino}</Link>
            </Button>
          </nav>
        </header>

        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-24 lg:px-8 lg:pt-20">
          <div className="max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="size-1.5 animate-pulse rounded-full bg-[oklch(0.7_0.17_250)]" />
              Presencia como servicio para instituciones educativas
            </span>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Una copia de Presencia para cada institución,{" "}
              <span className="bg-gradient-to-r from-[oklch(0.75_0.14_250)] to-[oklch(0.62_0.21_263)] bg-clip-text text-transparent">
                lista en minutos.
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
              Registre la institución, elija su plan y la plataforma aprovisiona en AWS su propia red, servidores y
              base de datos, la configura y la monitorea. Cada tenant queda aislado, con su URL y su administrador.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="h-11 px-5">
                <Link href={destino}>
                  {textoDestino} <ArrowRightIcon />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/20 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#planes">Ver planes</a>
              </Button>
            </div>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ["3", "planes"],
              ["2", "motores IaC"],
              ["1 VPC", "por tenant"],
              ["< 6 min", "por despliegue"],
            ].map(([valor, etiqueta]) => (
              <div key={etiqueta} className="border-l border-white/15 pl-4">
                <dt className="text-2xl font-semibold tracking-tight">{valor}</dt>
                <dd className="text-sm text-white/50">{etiqueta}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="planes" className="relative -mt-px bg-[oklch(0.13_0.015_264)] pb-24 text-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <div className="text-xs font-medium tracking-wider text-[oklch(0.75_0.14_250)] uppercase">
              Catálogo de planes
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">Elija la capacidad según la institución</h2>
            <p className="text-white/55">
              Cada plan define cómputo, almacenamiento y base de datos. El costo es aproximado con los servidores
              encendidos en us-east-1; un tenant suspendido solo paga discos e IP.
            </p>
          </div>
          {catalogo.length ? (
            <div className="grid items-stretch gap-6 md:grid-cols-3">
              {catalogo.map((plan) => (
                <PlanTarjeta
                  key={plan.id}
                  plan={plan}
                  oscuro
                  accion={
                    <Button
                      asChild
                      size="lg"
                      className={
                        plan.id === "estandar"
                          ? "h-10 w-full"
                          : "h-10 w-full border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      }
                    >
                      <Link href={conSesion ? "/tenants/nuevo" : "/login?next=/tenants/nuevo"}>
                        Crear tenant {plan.nombre}
                      </Link>
                    </Button>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 p-6 text-white/60">
              El catálogo no está disponible: la API de la plataforma no responde.
            </p>
          )}
        </div>
      </section>

      <section id="como" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="text-xs font-medium tracking-wider text-primary uppercase">Cómo funciona</div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              De la solicitud a la URL de la institución en cuatro pasos
            </h2>
            <p className="text-muted-foreground">
              La plataforma escanea la configuración, ejecuta Terraform o Pulumi, arranca los servidores desde una
              imagen preparada con Packer y Ansible, y espera a que la aplicación responda.
            </p>
            <ol className="grid gap-3 pt-4 sm:grid-cols-2">
              {PASOS.map((p) => (
                <li key={p.n} className="flex h-full gap-3 rounded-xl border bg-card p-4">
                  <span className="font-mono text-sm font-semibold text-primary">{p.n}</span>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{p.titulo}</div>
                    <div className="text-[13px] text-muted-foreground">{p.texto}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            {CARACTERISTICAS.map((c) => (
              <div key={c.titulo} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <c.icono weight="duotone" className="size-5" />
                </div>
                <div className="text-sm font-semibold">{c.titulo}</div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{c.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>© 2026 Presencia Cloud · Grupo GPT-6 AURA</span>
          <span className="font-mono">Terraform · Pulumi · Packer · Ansible · Prometheus · Grafana</span>
        </div>
      </footer>
    </div>
  )
}
