"use client"

import { CaretUpDownIcon, KeyIcon, SignOutIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { initials } from "@/lib/format"
import { useMe } from "@/lib/queries"
import { resilientFetch } from "@/lib/resilient-fetch"

export function UserMenu() {
  const { data: me } = useMe()
  const router = useRouter()
  const qc = useQueryClient()

  async function logout() {
    await resilientFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    qc.clear()
    router.replace("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {me ? (
                <>
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                      {initials(me.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{me.full_name}</span>
                    <span className="truncate font-mono text-xs text-sidebar-foreground/60">
                      Reg. {me.registration_code}
                    </span>
                  </div>
                  <CaretUpDownIcon className="ml-auto size-4 opacity-60" />
                </>
              ) : (
                <Skeleton className="h-8 w-full bg-sidebar-accent" />
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{me?.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {me?.role === "admin" ? "Administrador" : "Estudiante"}
                {me ? ` · Reg. ${me.registration_code}` : ""}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => router.push("/cambiar-contrasena")}>
                <KeyIcon />
                Cambiar contraseña
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={logout}>
                <SignOutIcon />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
