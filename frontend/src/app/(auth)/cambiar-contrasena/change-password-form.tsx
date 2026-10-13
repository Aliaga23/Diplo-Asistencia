"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, KeyIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Logo } from "@/components/brand/logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useMe } from "@/lib/queries"

const schema = z
  .object({
    current_password: z.string().min(1, "Ingresa tu contraseña actual"),
    new_password: z.string().min(8, "Mínimo 8 caracteres").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" })
type Values = z.infer<typeof schema>

export function ChangePasswordForm() {
  const router = useRouter()
  const { data: me } = useMe()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  })
  const { errors, isSubmitting } = form.formState
  const home = me?.role === "admin" ? "/admin" : "/estudiante"

  async function onSubmit(v: Values) {
    setError(null)
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: v.current_password, new_password: v.new_password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(typeof data.detail === "string" ? data.detail : "No se pudo cambiar la contraseña")
      return
    }
    toast.success("Contraseña actualizada")
    router.replace(home)
    router.refresh()
  }

  return (
    <div className="bg-grid-light relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <KeyIcon weight="duotone" className="size-5" />
          </div>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            {me?.must_change_password
              ? "Por seguridad, define una nueva contraseña antes de continuar."
              : "Actualiza la contraseña con la que ingresas al sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <WarningCircleIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FieldGroup className="gap-4">
              <Field data-invalid={!!errors.current_password}>
                <FieldLabel htmlFor="current">Contraseña actual</FieldLabel>
                <Input id="current" type="password" autoComplete="current-password" {...form.register("current_password")} />
                <FieldError errors={[errors.current_password]} />
              </Field>
              <Field data-invalid={!!errors.new_password}>
                <FieldLabel htmlFor="new">Nueva contraseña</FieldLabel>
                <Input id="new" type="password" autoComplete="new-password" {...form.register("new_password")} />
                <FieldDescription>Al menos 8 caracteres.</FieldDescription>
                <FieldError errors={[errors.new_password]} />
              </Field>
              <Field data-invalid={!!errors.confirm}>
                <FieldLabel htmlFor="confirm">Confirmar contraseña</FieldLabel>
                <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
                <FieldError errors={[errors.confirm]} />
              </Field>
            </FieldGroup>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isSubmitting} className="h-10">
                {isSubmitting && <Spinner />}
                Guardar contraseña
              </Button>
              {!me?.must_change_password && (
                <Button type="button" variant="ghost" onClick={() => router.push(home)}>
                  <ArrowLeftIcon />
                  Volver
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
