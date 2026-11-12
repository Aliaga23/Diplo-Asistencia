"use client"

import { LockKeyIcon, UserIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function FormularioIngreso() {
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const datos = Object.fromEntries(new FormData(e.currentTarget))
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
    if (res.ok) {
      const siguiente = new URLSearchParams(window.location.search).get("next")
      window.location.assign(siguiente?.startsWith("/") ? siguiente : "/panel")
      return
    }
    const cuerpo = await res.json().catch(() => ({}))
    setError(typeof cuerpo.detail === "string" ? cuerpo.detail : "No se pudo iniciar sesión")
    setCargando(false)
  }

  return (
    <form onSubmit={entrar}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="usuario">Usuario</FieldLabel>
          <div className="relative">
            <UserIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="usuario" name="usuario" className="h-10 pl-9" autoComplete="username" defaultValue="admin" required />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <div className="relative">
            <LockKeyIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type="password"
              className="h-10 pl-9"
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={cargando} className="h-10 w-full">
          {cargando && <Spinner />} Ingresar
        </Button>
      </FieldGroup>
    </form>
  )
}
