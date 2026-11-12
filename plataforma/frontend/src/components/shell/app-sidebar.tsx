"use client"

import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { NAV, activo } from "@/components/shell/nav"
import { UserMenu } from "@/components/shell/user-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const ruta = usePathname()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pt-4 pb-3">
        <Link href="/panel" className="px-1 text-sidebar-accent-foreground group-data-[collapsible=icon]:px-0">
          <Logo className="group-data-[collapsible=icon]:[&>div]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        {NAV.map((grupo) => (
          <SidebarGroup key={grupo.label}>
            <SidebarGroupLabel className="text-[11px] tracking-wider text-sidebar-foreground/45 uppercase">
              {grupo.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {grupo.items.map((item) => {
                const marcado = activo(item, ruta)
                const contenido = (
                  <>
                    <item.icon weight={marcado ? "fill" : "regular"} className={marcado ? "text-sidebar-primary" : ""} />
                    <span>{item.title}</span>
                    {item.externo && <ArrowSquareOutIcon className="ml-auto size-3.5 opacity-50" />}
                  </>
                )
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={marcado}
                      tooltip={item.title}
                      className="relative h-9 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:-left-2 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary"
                    >
                      {item.externo ? (
                        <a href={item.href} target="_blank" rel="noreferrer">
                          {contenido}
                        </a>
                      ) : (
                        <Link href={item.href}>{contenido}</Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="pb-3">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
