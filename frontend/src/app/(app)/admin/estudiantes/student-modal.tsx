"use client"

import {
  ArrowCounterClockwiseIcon,
  EnvelopeSimpleIcon,
  GraduationCapIcon,
  IdentificationCardIcon,
  ProhibitIcon,
  UserCheckIcon,
} from "@phosphor-icons/react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useCourse } from "@/components/app-shell/course-context"

import { StatusSelect } from "@/components/attendance/status-select"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fmtDay, fmtPct, fmtRange, initials, todayISO } from "@/lib/format"
import { useSetAttendance, useStudentAttendance, useUpdateStudent } from "@/lib/queries"
import type { StudentSummary } from "@/lib/types"

/** Ficha del estudiante en modal: resumen, acciones de cuenta e historial editable. */
export function StudentModal({
  student,
  onOpenChange,
}: {
  student: StudentSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const { course } = useCourse()
  const { data, isLoading } = useStudentAttendance(student?.id ?? null, course?.id)
  const setAttendance = useSetAttendance()
  const update = useUpdateStudent()
  const today = todayISO()
  const [tab, setTab] = useState<"past" | "upcoming">("past")
  const history = useMemo(() => {
    const all = data?.history ?? []
    return tab === "past"
      ? all.filter((h) => h.session.session_date <= today)
      : [...all.filter((h) => h.session.session_date > today)].reverse()
  }, [data, tab, today])

  return (
    <Modal open={!!student} onOpenChange={onOpenChange} size="lg">
      {student && (
        <>
          <ModalHeader
            title={student.full_name}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 font-mono">
                  <IdentificationCardIcon /> {student.registration_code}
                </span>
                {student.email && (
                  <span className="inline-flex items-center gap-1">
                    <EnvelopeSimpleIcon /> {student.email}
                  </span>
                )}
                {student.career && (
                  <span className="inline-flex items-center gap-1">
                    <GraduationCapIcon /> {student.career}
                  </span>
                )}
              </span>
            }
            actions={
              student.is_active ? (
                <Badge className="bg-primary/10 text-primary">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )
            }
          />

          <ModalBody className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                  {initials(student.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 grid-cols-5 divide-x rounded-xl border text-center">
                {[
                  { k: "Asistencia", v: fmtPct(student.attendance_rate) },
                  { k: "Presente", v: student.present },
                  { k: "Tarde", v: student.late },
                  { k: "Justif.", v: student.excused },
                  { k: "Faltas", v: student.absent },
                ].map((x) => (
                  <div key={x.k} className="py-2.5">
                    <div className="text-base font-semibold tabular">{x.v}</div>
                    <div className="text-[11px] text-muted-foreground">{x.k}</div>
                  </div>
                ))}
              </div>
            </div>
            <Progress value={student.attendance_rate} className="h-1.5" />

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Historial en {course?.code}</h3>
                  <p className="text-xs text-muted-foreground">Puedes modificar la asistencia de cualquier fecha.</p>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(v as "past" | "upcoming")}>
                  <TabsList>
                    <TabsTrigger value="past">Dictadas</TabsTrigger>
                    <TabsTrigger value="upcoming">Programadas</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {history.length === 0 && (
                    <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No hay sesiones en esta vista.
                    </li>
                  )}
                  {history.map((h) => {
                    const isToday = h.session.session_date === today
                    const future = h.session.session_date > today
                    return (
                      <li key={h.session.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {fmtDay(h.session.session_date)}
                            {isToday && (
                              <Badge className="h-4 bg-primary/10 px-1.5 text-[10px] text-primary">Hoy</Badge>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">
                              {fmtRange(h.session.start_time, h.session.end_time)}
                            </span>
                            {" · "}
                            {h.session.topic}
                          </div>
                        </div>
                        <StatusSelect
                          value={h.status}
                          recorded={h.recorded}
                          placeholder={future ? "Programada" : isToday ? "Sin registro" : "Falta"}
                          disabled={setAttendance.isPending}
                          onChange={(status) =>
                            setAttendance.mutate(
                              { sessionId: h.session.id, studentId: student.id, status, note: h.note },
                              {
                                onSuccess: () => toast.success("Asistencia actualizada"),
                                onError: (e) => toast.error(e.message),
                              }
                            )
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </ModalBody>

          <ModalFooter className="sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: student.id, reset_password: true },
                    {
                      onSuccess: () => toast.success("Contraseña restablecida a la contraseña común"),
                      onError: (e) => toast.error(e.message),
                    }
                  )
                }
              >
                <ArrowCounterClockwiseIcon />
                Restablecer contraseña
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: student.id, is_active: !student.is_active },
                    {
                      onSuccess: () =>
                        toast.success(student.is_active ? "Cuenta desactivada" : "Cuenta activada"),
                      onError: (e) => toast.error(e.message),
                    }
                  )
                }
              >
                {student.is_active ? <ProhibitIcon /> : <UserCheckIcon />}
                {student.is_active ? "Desactivar cuenta" : "Activar cuenta"}
              </Button>
            </div>
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
