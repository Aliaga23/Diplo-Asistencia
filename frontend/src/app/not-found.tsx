import { CompassIcon } from "@phosphor-icons/react/ssr"
import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="bg-grid-light flex min-h-svh flex-col items-center justify-center gap-8 px-4 text-center">
      <Logo />
      <div className="space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <CompassIcon weight="duotone" className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          La dirección que buscas no existe o fue movida.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
