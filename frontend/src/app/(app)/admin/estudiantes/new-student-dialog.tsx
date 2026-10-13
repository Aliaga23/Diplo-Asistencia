"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { UserPlusIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useCourse } from "@/components/app-shell/course-context"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"

const schema = z.object({
  registration_code: z.string().trim().min(1, "Ingresa el número de registro").max(50),
  full_name: z.string().trim().min(2, "Ingresa el nombre completo").max(150),
  email: z.union([z.literal(""), z.email("Correo inválido")]),
  career: z.string().max(150).optional(),
})
type Values = z.infer<typeof schema>

export function NewStudentDialog() {
  const { course } = useCourse()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { registration_code: "", full_name: "", email: "", career: "" },
  })
  const { errors } = form.formState

  async function onSubmit(v: Values) {
    setSaving(true)
    try {
      await api.post("/students", {
        registration_code: v.registration_code,
        full_name: v.full_name,
        email: v.email || null,
        career: v.career || null,
        course_id: course?.id ?? null,
      })
      toast.success("Estudiante inscrito", {
        description: `${v.full_name} ya forma parte de ${course?.code ?? "el programa"}.`,
      })
      qc.invalidateQueries({ queryKey: ["students"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      setOpen(false)
      form.reset()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlusIcon weight="bold" />
        Nuevo estudiante
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <ModalHeader
            icon={UserPlusIcon}
            title="Nuevo estudiante"
            description={`Se inscribe en el programa ${course?.code ?? "activo"}. Si el registro ya existe, solo se agrega a este programa.`}
          />
          <ModalBody>
            <FieldGroup className="gap-4">
              <Field data-invalid={!!errors.registration_code}>
                <FieldLabel htmlFor="ns-reg">Número de registro</FieldLabel>
                <Input
                  id="ns-reg"
                  data-autofocus
                  className="font-mono"
                  placeholder="218166141"
                  {...form.register("registration_code")}
                />
                <FieldDescription>Será su usuario para ingresar al sistema.</FieldDescription>
                <FieldError errors={[errors.registration_code]} />
              </Field>
              <Field data-invalid={!!errors.full_name}>
                <FieldLabel htmlFor="ns-name">Nombre completo</FieldLabel>
                <Input id="ns-name" {...form.register("full_name")} />
                <FieldError errors={[errors.full_name]} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="ns-email">Correo (opcional)</FieldLabel>
                  <Input id="ns-email" type="email" {...form.register("email")} />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ns-career">Carrera (opcional)</FieldLabel>
                  <Input id="ns-career" {...form.register("career")} />
                </Field>
              </div>
            </FieldGroup>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              Registrar
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  )
}
