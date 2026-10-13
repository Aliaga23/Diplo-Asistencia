"use client"

import { KeyIcon, ListIcon, SignOutIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { LogoMark } from "@/components/brand/logo"
import type { NavItem } from "@/components/app-shell/nav"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Button } from "@/components/ui/button"
import { useMe } from "@/lib/queries"
import { cn } from "@/lib/utils"

/** Navegación para móvil en un modal centrado (sin paneles laterales). */
export function MobileNav({ nav }: { nav: { label: string; items: NavItem[] }[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: me } = useMe()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    qc.clear()
    router.replace("/login")
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú" onClick={() => setOpen(true)}>
        <ListIcon className="size-5" />
      </Button>
      <Modal open={open} onOpenChange={setOpen} size="sm">
        <ModalHeader
          title={me?.full_name ?? "Menú"}
          description={me ? `${me.role === "admin" ? "Administrador" : "Estudiante"} · Reg. ${me.registration_code}` : undefined}
          actions={<LogoMark className="size-7" />}
        />
        <ModalBody className="space-y-4">
          {nav.map((g) => (
            <div key={g.label}>
              <div className="mb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {g.label}
              </div>
              <ul className="space-y-1">
                {g.items.map((item) => {
                  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        <item.icon weight={active ? "fill" : "regular"} className="size-5" />
                        {item.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </ModalBody>
        <ModalFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false)
              router.push("/cambiar-contrasena")
            }}
          >
            <KeyIcon />
            Contraseña
          </Button>
          <Button variant="outline" className="text-destructive" onClick={logout}>
            <SignOutIcon />
            Cerrar sesión
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
