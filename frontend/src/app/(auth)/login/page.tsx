import {
  ChartLineUpIcon,
  FileXlsIcon,
  FingerprintSimpleIcon,
  ShieldCheckeredIcon,
} from "@phosphor-icons/react/ssr"
import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/app/(auth)/login/login-form"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Iniciar sesión" }

const FEATURES = [
  {
    icon: FingerprintSimpleIcon,
    title: "Registro en un toque",
    text: "Cada estudiante marca su asistencia del día desde cualquier dispositivo.",
  },
  {
    icon: FileXlsIcon,
    title: "Carga masiva desde Excel",
    text: "Importa estudiantes, horarios y fechas con validación fila por fila.",
  },
  {
    icon: ChartLineUpIcon,
    title: "Indicadores en tiempo real",
    text: "Panel con tasa de asistencia, tardanzas y control por sesión.",
  },
  {
    icon: ShieldCheckeredIcon,
    title: "Control por roles",
    text: "Administradores con edición total; estudiantes, solo su día.",
  },
]

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-[oklch(0.13_0.015_264)] text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_75%)]" />
        <div className="absolute -top-40 -left-32 size-[560px] rounded-full bg-[oklch(0.55_0.22_263)] opacity-30 blur-[140px]" />
        <div className="absolute -right-24 bottom-0 size-[420px] rounded-full bg-[oklch(0.6_0.18_240)] opacity-20 blur-[120px]" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Logo className="[&_span:last-child]:text-white/55" />

          <div className="max-w-xl space-y-10">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <span className="size-1.5 animate-pulse rounded-full bg-[oklch(0.7_0.17_250)]" />
                Sistema de registro de asistencia
              </span>
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance xl:text-5xl">
                La asistencia de tu curso,{" "}
                <span className="bg-gradient-to-r from-[oklch(0.75_0.14_250)] to-[oklch(0.62_0.21_263)] bg-clip-text text-transparent">
                  clara y al instante.
                </span>
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-white/60">
                Centraliza horarios, estudiantes y registros en una sola plataforma con reglas de
                negocio claras y trazabilidad completa.
              </p>
            </div>

            <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <f.icon weight="duotone" className="size-5 text-[oklch(0.75_0.14_250)]" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{f.title}</div>
                    <p className="text-[13px] leading-snug text-white/50">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-xs text-white/40">
            <span>© {2026} Presencia</span>
            <span className="font-mono">FastAPI · Next.js · PostgreSQL</span>
          </div>
        </div>
      </aside>

      {/* Formulario */}
      <main className="relative flex flex-col bg-background">
        <div className="bg-grid-light absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_40%)] dark:opacity-40" />
        <div className="relative flex items-center justify-between p-6 lg:hidden">
          <Logo />
        </div>
        <div className="relative flex flex-1 items-center justify-center px-6 pb-16 lg:px-12">
          <div className="w-full max-w-[400px] space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</h2>
              <p className="text-sm text-muted-foreground">
                Ingresa con tu número de registro para marcar o gestionar la asistencia.
              </p>
            </div>
            <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
