"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { GraduationCapIcon } from "@phosphor-icons/react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useCreateCourse, useUpdateCourse } from "@/lib/queries"
import type { Course } from "@/lib/types"

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Ingresa un código")
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones"),
  name: z.string().trim().min(2, "Ingresa el nombre del programa").max(150),
  period: z.string().trim().min(1, "Ingresa la gestión o periodo").max(30),
})
type Values = z.infer<typeof schema>

/** Crear (sin `program`) o editar (con `program`) un programa académico. */
export function ProgramModal({
  open,
  onOpenChange,
  program,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  program?: Course | null
  onSaved?: (course: Course) => void
}) {
  const create = useCreateCourse()
  const update = useUpdateCourse()
  const editing = !!program
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: program
      ? { code: program.code, name: program.name, period: program.period }
      : { code: "", name: "", period: "2026-II" },
  })
  const { errors } = form.formState
  const pending = create.isPending || update.isPending

  function onSubmit(v: Values) {
    const opts = {
      onSuccess: (course: Course) => {
        toast.success(editing ? "Programa actualizado" : "Programa creado", {
          description: `${course.code} · ${course.name}`,
        })
        onSaved?.(course)
        onOpenChange(false)
        form.reset()
      },
      onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
    }
    if (program) update.mutate({ id: program.id, ...v }, opts)
    else create.mutate(v, opts)
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <ModalHeader
          icon={GraduationCapIcon}
          title={editing ? "Editar programa" : "Nuevo programa"}
          description="Cada programa tiene sus propios estudiantes inscritos, horarios y control de asistencia."
        />
        <ModalBody>
          <FieldGroup className="gap-5">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="pg-name">Nombre del programa</FieldLabel>
              <Input
                id="pg-name"
                data-autofocus
                placeholder="Ej. Inteligencia Artificial Aplicada"
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.code}>
                <FieldLabel htmlFor="pg-code">Código</FieldLabel>
                <Input id="pg-code" className="font-mono uppercase" placeholder="DIP-IA-2026" {...form.register("code")} />
                <FieldDescription>Identificador único y corto.</FieldDescription>
                <FieldError errors={[errors.code]} />
              </Field>
              <Field data-invalid={!!errors.period}>
                <FieldLabel htmlFor="pg-period">Gestión / periodo</FieldLabel>
                <Input id="pg-period" placeholder="2026-II" {...form.register("period")} />
                <FieldError errors={[errors.period]} />
              </Field>
            </div>
          </FieldGroup>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {editing ? "Guardar cambios" : "Crear programa"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
