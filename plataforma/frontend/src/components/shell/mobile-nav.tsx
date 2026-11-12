"use client"

import { ListIcon, SignOutIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { LogoMark } from "@/components/brand/logo"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { NAV, activo, cerrarSesion } from "@/components/shell/nav"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const [abierto, setAbierto] = useState(false)
  const ruta = usePathname()
  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú" onClick={() => setAbierto(true)}>
        <ListIcon className="size-5" />
      </Button>
      <Modal open={abierto} onOpenChange={setAbierto} size="sm">
        <ModalHeader
          title="Presencia Cloud"
          description="Plataforma de tenants"
          actions={<LogoMark className="size-7" />}
        />
        <ModalBody className="space-y-4">
          {NAV.map((g) => (
            <div key={g.label}>
              <div className="mb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {g.label}
              </div>
              <ul className="space-y-1">
                {g.items.map((item) => {
                  const marcado = activo(item, ruta)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        target={item.externo ? "_blank" : undefined}
                        onClick={() => setAbierto(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          marcado ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        <item.icon weight={marcado ? "fill" : "regular"} className="size-5" />
                        {item.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" className="text-destructive" onClick={cerrarSesion}>
            <SignOutIcon />
            Cerrar sesión
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
