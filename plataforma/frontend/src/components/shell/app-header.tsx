"use client"

import { usePathname } from "next/navigation"
import { Fragment } from "react"

import { useCrumbLabels } from "@/components/shell/breadcrumb-store"
import { LiveClock } from "@/components/shell/live-clock"
import { MobileNav } from "@/components/shell/mobile-nav"
import { ThemeToggle } from "@/components/shell/theme-toggle"
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

const ETIQUETAS: Record<string, string> = {
  panel: "Panel",
  tenants: "Instituciones",
  nuevo: "Nuevo tenant",
  planes: "Catálogo de planes",
  eventos: "Alertas y eventos",
}

export function AppHeader() {
  const ruta = usePathname()
  const partes = ruta.split("/").filter(Boolean)
  const nombres = useCrumbLabels()
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <MobileNav />
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <Separator orientation="vertical" className="mr-1 hidden data-[orientation=vertical]:h-4 md:block" />
      <Breadcrumb>
        <BreadcrumbList>
          {partes.map((parte, i) => {
            const href = "/" + partes.slice(0, i + 1).join("/")
            const ultimo = i === partes.length - 1
            const nombre = nombres.get(href) ?? ETIQUETAS[parte] ?? parte
            return (
              <Fragment key={href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {ultimo ? (
                    <BreadcrumbPage>{nombre}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href}>{nombre}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-2 hidden items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground xl:flex">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          AWS · us-east-1
        </span>
        <LiveClock />
        <ThemeToggle />
      </div>
    </header>
  )
}
