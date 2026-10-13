"use client"

import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CalendarCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  GraduationCapIcon,
  IdentificationCardIcon,
  NotePencilIcon,
  ProhibitIcon,
  UserCheckIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useCrumb } from "@/components/app-shell/breadcrumb-store"
import { useCourse } from "@/components/app-shell/course-context"
import { StatusSelect } from "@/components/attendance/status-select"
import { ConfirmModal } from "@/components/common/confirm-modal"
import { KpiCard } from "@/components/common/kpi-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SOURCE_LABEL, fmtDay, fmtPct, fmtRange, fmtStamp, initials, todayISO } from "@/lib/format"
import { useSetAttendance, useStudent, useStudentAttendance, useUpdateStudent } from "@/lib/queries"
import { cn } from "@/lib/utils"

type Tab = "past" | "upcoming"

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const { course } = useCourse()
  const { data: student, isLoading } = useStudent(id, course?.id)
  const { data: attendance, isLoading: loadingHistory } = useStudentAttendance(id, course?.id)
  const setAttendance = useSetAttendance()
  const update = useUpdateStudent()
  const [tab, setTab] = useState<Tab>("past")
  const [confirmToggle, setConfirmToggle] = useState(false)
  const today = todayISO()

  useCrumb(`/admin/estudiantes/${id}`, student?.full_name)

  const rows = useMemo(() => {
    const all = attendance?.history ?? []
    return tab === "past"
      ? all.filter((h) => h.session.session_date <= today)
      : [...all.filter((h) => h.session.session_date > today)].reverse()
  }, [attendance, tab, today])
  const upcoming = (attendance?.history ?? []).filter((h) => h.session.session_date > today).length

  function resetPassword() {
    if (!student) return
    update.mutate(
      { id: student.id, reset_password: true },
      {
        onSuccess: () => toast.success("Contraseña restablecida", { description: "Vuelve a ser la contraseña común." }),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  function toggleActive() {
    if (!student) return
    update.mutate(
      { id: student.id, is_active: !student.is_active },
      {
        onSuccess: () => {
          setConfirmToggle(false)
          toast.success(student.is_active ? "Cuenta desactivada" : "Cuenta activada")
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/admin/estudiantes">
          <ArrowLeftIcon />
          Estudiantes
        </Link>
      </Button>

      {isLoading || !student ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Encabezado del estudiante */}
          <div className="mb-6 flex flex-col gap-5 md:mb-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                  {initials(student.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{student.full_name}</h1>
                  {student.is_active ? (
                    <Badge variant="outline" className="gap-1.5 font-normal">
                      <span className="size-1.5 rounded-full bg-status-present" />
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <IdentificationCardIcon /> {student.registration_code}
                  </span>
                  {student.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <EnvelopeSimpleIcon /> {student.email}
                    </span>
                  )}
                  {student.career && (
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCapIcon /> {student.career}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetPassword} disabled={update.isPending}>
                <ArrowCounterClockwiseIcon />
                Restablecer contraseña
              </Button>
              <Button variant="outline" onClick={() => setConfirmToggle(true)} disabled={update.isPending}>
                {student.is_active ? <ProhibitIcon /> : <UserCheckIcon />}
                {student.is_active ? "Desactivar cuenta" : "Activar cuenta"}
              </Button>
            </div>
          </div>

          {/* Indicadores del programa activo */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              accent
              label={`Asistencia en ${course?.code ?? "el programa"}`}
              icon={CalendarCheckIcon}
              value={fmtPct(student.attendance_rate)}
              hint={`Sobre ${student.sessions_total} sesiones dictadas`}
            >
              <Progress value={student.attendance_rate} className="h-1.5 bg-white/10" />
            </KpiCard>
            <KpiCard label="Presente" icon={CheckCircleIcon} value={student.present} hint="Registros a tiempo" />
            <KpiCard label="Tarde" icon={ClockIcon} value={student.late} hint="Después de la tolerancia" />
            <KpiCard
              label="Faltas y justificados"
              icon={XCircleIcon}
              value={
                <>
                  {student.absent}
                  <span className="text-lg text-muted-foreground"> / {student.excused}</span>
                </>
              }
              hint="Faltas / justificados"
            />
          </div>

          {/* Historial */}
          <Card className="mt-4 gap-0 overflow-hidden py-0">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">Historial de asistencia</h2>
                <p className="text-sm text-muted-foreground">
                  Puedes modificar la asistencia de las sesiones dictadas y del día.
                </p>
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList>
                  <TabsTrigger value="past">Dictadas</TabsTrigger>
                  <TabsTrigger value="upcoming">
                    Programadas <Badge variant="secondary" className="ml-1 tabular">{upcoming}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {loadingHistory ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyTitle>Sin sesiones en esta vista</EmptyTitle>
                  <EmptyDescription>No hay sesiones {tab === "past" ? "dictadas" : "programadas"}.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="pl-4">Fecha</TableHead>
                    <TableHead>Tema</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Marcado</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="pr-4 text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((h) => {
                    const isToday = h.session.session_date === today
                    const future = h.session.session_date > today
                    return (
                      <TableRow key={h.session.id} className={cn(isToday && "bg-primary/[0.04]")}>
                        <TableCell className="py-3 pl-4 font-medium">
                          <div className="flex items-center gap-2">
                            {fmtDay(h.session.session_date)}
                            {isToday && (
                              <Badge className="h-4 bg-primary/10 px-1.5 text-[10px] text-primary">Hoy</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-muted-foreground">{h.session.topic}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmtRange(h.session.start_time, h.session.end_time)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{fmtStamp(h.marked_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {h.source ? SOURCE_LABEL[h.source] : "—"}
                          {h.note && (
                            <Tooltip>
                              <TooltipTrigger className="ml-1 inline-flex align-middle text-primary">
                                <NotePencilIcon />
                              </TooltipTrigger>
                              <TooltipContent>{h.note}</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {future ? (
                            <Badge variant="outline" className="font-normal">
                              Programada
                            </Badge>
                          ) : (
                            <StatusSelect
                              className="ml-auto"
                              value={h.status}
                              recorded={h.recorded}
                              placeholder={isToday ? "Sin registro" : "Falta"}
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
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>

          <ConfirmModal
            open={confirmToggle}
            onOpenChange={setConfirmToggle}
            title={student.is_active ? "¿Desactivar la cuenta?" : "¿Activar la cuenta?"}
            description={
              student.is_active
                ? `${student.full_name} no podrá ingresar al sistema. Su historial se conserva.`
                : `${student.full_name} podrá volver a ingresar con su número de registro.`
            }
            confirmLabel={student.is_active ? "Desactivar" : "Activar"}
            destructive={student.is_active}
            loading={update.isPending}
            onConfirm={toggleActive}
          />
        </>
      )}
    </>
  )
}
