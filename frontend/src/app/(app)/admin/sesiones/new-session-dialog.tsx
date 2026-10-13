"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarPlusIcon, PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useCourse } from "@/components/app-shell/course-context"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { todayISO } from "@/lib/format"
import { useCreateSession } from "@/lib/queries"

const schema = z
  .object({
    session_date: z.string().min(1, "Selecciona la fecha"),
    start_time: z.string().min(1, "Hora de inicio requerida"),
    end_time: z.string().min(1, "Hora de fin requerida"),
    topic: z.string().max(200).optional(),
  })
  .refine((v) => v.end_time > v.start_time, {
    path: ["end_time"],
    message: "Debe ser posterior a la hora de inicio",
  })
type Values = z.infer<typeof schema>

export function NewSessionDialog() {
  const { course } = useCourse()
  const [open, setOpen] = useState(false)
  const mutation = useCreateSession(course?.id)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { session_date: todayISO(), start_time: "19:00", end_time: "21:30", topic: "" },
  })
  const { errors } = form.formState

  function onSubmit(v: Values) {
    mutation.mutate(
      { ...v, topic: v.topic || undefined },
      {
        onSuccess: () => {
          toast.success("Sesión creada")
          setOpen(false)
          form.reset()
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon weight="bold" />
        Nueva sesión
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <ModalHeader
            icon={CalendarPlusIcon}
            title="Nueva sesión"
            description={`Agrega una fecha y horario de clase al programa ${course?.code ?? ""}.`}
          />
          <ModalBody>
            <FieldGroup className="gap-4">
              <Field data-invalid={!!errors.session_date}>
                <FieldLabel htmlFor="session_date">Fecha</FieldLabel>
                <Input id="session_date" type="date" data-autofocus {...form.register("session_date")} />
                <FieldError errors={[errors.session_date]} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!errors.start_time}>
                  <FieldLabel htmlFor="start_time">Hora de inicio</FieldLabel>
                  <Input id="start_time" type="time" {...form.register("start_time")} />
                  <FieldError errors={[errors.start_time]} />
                </Field>
                <Field data-invalid={!!errors.end_time}>
                  <FieldLabel htmlFor="end_time">Hora de fin</FieldLabel>
                  <Input id="end_time" type="time" {...form.register("end_time")} />
                  <FieldError errors={[errors.end_time]} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="topic">Tema</FieldLabel>
                <Input id="topic" placeholder="Ej. Normalización de bases de datos" {...form.register("topic")} />
              </Field>
            </FieldGroup>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              Crear sesión
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  )
}
