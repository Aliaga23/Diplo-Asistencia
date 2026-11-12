import {
  ChartLineUpIcon,
  CloudArrowUpIcon,
  GitForkIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/ssr"
import type { Metadata } from "next"
import Link from "next/link"

import { FormularioIngreso } from "@/app/login/formulario"
import { Logo } from "@/components/brand/logo"

export const metadata: Metadata = { title: "Ingresar" }

const PUNTOS = [
  { icono: CloudArrowUpIcon, titulo: "Despliegue automático", texto: "Red, servidores y base por institución." },
  { icono: GitForkIcon, titulo: "Terraform o Pulumi", texto: "Dos motores, los mismos recursos." },
  { icono: ShieldCheckIcon, titulo: "Tenants aislados", texto: "VPC, base y credenciales propias." },
  { icono: ChartLineUpIcon, titulo: "Salud en Grafana", texto: "Métricas y alertas por tenant." },
]

export default function Ingreso() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.13_0.015_264)] text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_75%)]" />
        <div className="absolute -top-40 -left-32 size-[560px] rounded-full bg-[oklch(0.55_0.22_263)] opacity-30 blur-[140px]" />
        <div className="absolute -right-24 bottom-0 size-[420px] rounded-full bg-[oklch(0.6_0.18_240)] opacity-20 blur-[120px]" />
        <div className="relative z-10 flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Link href="/">
            <Logo className="[&_span:last-child]:text-white/55" />
          </Link>
          <div className="max-w-xl space-y-10">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <span className="size-1.5 animate-pulse rounded-full bg-[oklch(0.7_0.17_250)]" />
                Consola de administración
              </span>
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance xl:text-5xl">
                Cada institución,{" "}
                <span className="bg-gradient-to-r from-[oklch(0.75_0.14_250)] to-[oklch(0.62_0.21_263)] bg-clip-text text-transparent">
                  su propia Presencia.
                </span>
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-white/60">
                Cree, suspenda, reanude y monitoree los tenants de todas las instituciones desde un solo lugar.
              </p>
            </div>
            <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {PUNTOS.map((p) => (
                <li key={p.titulo} className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <p.icono weight="duotone" className="size-5 text-[oklch(0.75_0.14_250)]" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{p.titulo}</div>
                    <p className="text-[13px] leading-snug text-white/50">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>© 2026 Presencia Cloud</span>
            <span className="font-mono">AWS · Terraform · Pulumi · Grafana</span>
          </div>
        </div>
      </aside>

      <main className="relative flex flex-col bg-background">
        <div className="bg-grid-light absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_40%)] dark:opacity-40" />
        <div className="relative flex items-center justify-between p-6 lg:hidden">
          <Logo />
        </div>
        <div className="relative flex flex-1 items-center justify-center px-6 pb-16 lg:px-12">
          <div className="w-full max-w-[400px] space-y-8">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-primary">GRUPO GPT 6</p>
              <h2 className="text-2xl font-semibold tracking-tight">Consola de la plataforma</h2>
              <p className="text-sm text-muted-foreground">
                Ingrese con la cuenta de administrador de la plataforma.
              </p>
            </div>
            <FormularioIngreso />
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/#planes" className="text-primary hover:underline">
                Ver el catálogo de planes
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
