"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
  IdentificationCardIcon,
  LockKeyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useIntro } from "@/components/brand/login-intro"
import { Spinner } from "@/components/ui/spinner"
import { MENSAJE_SIN_SERVIDOR, errorMessage, resilientFetch } from "@/lib/resilient-fetch"
import type { User } from "@/lib/types"

const schema = z.object({
  registration_code: z
    .string()
    .trim()
    .min(1, "Ingresa tu número de registro")
    .max(50, "El registro es demasiado largo"),
  password: z.string().min(1, "Ingresa tu contraseña"),
})
type Values = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const intro = useIntro()
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(
    params.get("expired") ? "Tu sesión expiró. Vuelve a ingresar." : null
  )
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { registration_code: "", password: "" },
  })

  async function onSubmit(values: Values) {
    setError(null)
    let res: Response
    try {
      res = await resilientFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
    } catch {
      setError(MENSAJE_SIN_SERVIDOR)
      return
    }
    if (!res.ok) {
      setError(await errorMessage(res, "No se pudo iniciar sesión"))
      return
    }
    const data = await res.json()
    const user = data.user as User
    if (user.must_change_password) {
      router.replace("/cambiar-contrasena")
      return
    }
    const next = params.get("next")
    const home = user.role === "admin" ? "/admin" : "/estudiante"
    const allowed = next && next.startsWith(user.role === "admin" ? "/admin" : "/estudiante")
    intro.play(allowed ? next : home)
  }

  const { errors, isSubmitting } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.registration_code}>
          <FieldLabel htmlFor="registration_code">Número de registro</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <IdentificationCardIcon className="size-[18px]" />
            </InputGroupAddon>
            <InputGroupInput
              id="registration_code"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Ej. 218166141"
              className="font-mono tracking-wide"
              aria-invalid={!!errors.registration_code}
              {...form.register("registration_code")}
            />
          </InputGroup>
          <FieldError errors={[errors.registration_code]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <LockKeyIcon className="size-[18px]" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeSlashIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" className="h-11 w-full text-sm" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : null}
        Ingresar
        {!isSubmitting && <ArrowRightIcon weight="bold" />}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Ingresa con tu número de registro institucional y la contraseña asignada.
      </p>
    </form>
  )
}
