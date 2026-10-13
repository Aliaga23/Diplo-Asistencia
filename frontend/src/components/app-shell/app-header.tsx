"use client"

import { usePathname } from "next/navigation"
import { Fragment } from "react"

import { useCrumbLabels } from "@/components/app-shell/breadcrumb-store"
import { LiveClock } from "@/components/app-shell/live-clock"
import { MobileNav } from "@/components/app-shell/mobile-nav"
import type { NavItem } from "@/components/app-shell/nav"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const LABELS: Record<string, string> = {
  admin: "Administración",
  estudiante: "Estudiante",
  estudiantes: "Estudiantes",
  sesiones: "Sesiones",
  importaciones: "Importaciones",
  programas: "Programas",
  historial: "Historial",
}

export function AppHeader({ nav }: { nav: { label: string; items: NavItem[] }[] }) {
  const pathname = usePathname()
  const parts = pathname.split("/").filter(Boolean)
  const crumbs = useCrumbLabels()

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <MobileNav nav={nav} />
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <Separator orientation="vertical" className="mr-1 hidden data-[orientation=vertical]:h-4 md:block" />
      <Breadcrumb>
        <BreadcrumbList>
          {parts.map((p, i) => {
            const href = "/" + parts.slice(0, i + 1).join("/")
            const last = i === parts.length - 1
            const label = crumbs.get(href) ?? LABELS[p] ?? "Detalle"
            return (
              <Fragment key={href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className={i === 0 && parts.length > 1 ? "hidden md:block" : ""}>
                  {last ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <LiveClock />
        <ThemeToggle />
      </div>
    </header>
  )
}
