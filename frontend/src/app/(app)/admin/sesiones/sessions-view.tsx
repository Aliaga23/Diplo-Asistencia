"use client"

import {
  ArrowRightIcon,
  CalendarXIcon,
  DotsThreeVerticalIcon,
  FileArrowUpIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { NewSessionDialog } from "@/app/(app)/admin/sesiones/new-session-dialog"
import { useCourse } from "@/components/app-shell/course-context"
import { AttendanceBar } from "@/components/attendance/attendance-bar"
import { ConfirmModal } from "@/components/common/confirm-modal"
import { PageHeader } from "@/components/common/page-header"
import { ImportDialog } from "@/components/imports/import-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fmtPct, fmtRange, parseDay, todayISO } from "@/lib/format"
import { useDeleteSession, useSessions } from "@/lib/queries"
import type { ClassSession } from "@/lib/types"
import { cn } from "@/lib/utils"

type Tab = "upcoming" | "past" | "all"

function DayBlock({ day, today }: { day: string; today: boolean }) {
  const d = parseDay(day)
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-lg border py-1.5 leading-none",
        today ? "border-primary bg-primary text-primary-foreground" : "bg-card"
      )}
    >
      <span className={cn("text-[10px] font-medium uppercase", today ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {format(d, "EEE", { locale: es })}
      </span>
      <span className="mt-1 text-lg font-semibold tabular">{format(d, "d")}</span>
      <span className={cn("mt-0.5 text-[10px] uppercase", today ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {format(d, "MMM", { locale: es })}
      </span>
    </div>
  )
}

export function SessionsView() {
  const { course } = useCourse()
  const { data, isLoading } = useSessions(course?.id)
  const del = useDeleteSession()
  const [tab, setTab] = useState<Tab>("upcoming")
  const [toDelete, setToDelete] = useState<ClassSession | null>(null)
  const today = todayISO()

  const list = useMemo(() => {
    const all = data ?? []
    if (tab === "upcoming") return all.filter((s) => s.session_date >= today)
    if (tab === "past") return [...all.filter((s) => s.session_date < today)].reverse()
    return all
  }, [data, tab, today])

  const upcoming = (data ?? []).filter((s) => s.session_date >= today).length
  const past = (data ?? []).length - upcoming

  return (
    <>
      <PageHeader
        eyebrow={course ? `${course.code} · ${course.period}` : undefined}
        title="Sesiones y asistencia"
        description="Horarios y fechas de clase del programa activo. Abre una sesión para revisar o modificar la asistencia de cada estudiante."
        actions={
          <>
            <ImportDialog
              kind="sessions"
              trigger={(open) => (
                <Button variant="outline" onClick={open}>
                  <FileArrowUpIcon />
                  Importar horarios
                </Button>
              )}
            />
            <NewSessionDialog />
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Próximas <Badge variant="secondary" className="ml-1 tabular">{upcoming}</Badge>
          </TabsTrigger>
          <TabsTrigger value="past">
            Dictadas <Badge variant="secondary" className="ml-1 tabular">{past}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarXIcon />
              </EmptyMedia>
              <EmptyTitle>No hay sesiones en esta vista</EmptyTitle>
              <EmptyDescription>Importa los horarios desde Excel o crea una sesión manualmente.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewSessionDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-4">Fecha</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead className="w-[240px]">Asistencia</TableHead>
                <TableHead className="w-[120px] pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => {
                const isToday = s.session_date === today
                const future = s.session_date > today
                const attended = s.present + s.late
                const rate = s.enrolled ? (attended / s.enrolled) * 100 : 0
                return (
                  <TableRow key={s.id} className={cn(isToday && "bg-primary/[0.04]")}>
                    <TableCell className="py-3 pl-4">
                      <DayBlock day={s.session_date} today={isToday} />
                    </TableCell>
                    <TableCell className="max-w-[340px]">
                      <div className="truncate font-medium">{s.topic ?? "Sin tema"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {isToday ? (
                          <span className="font-medium text-primary">Hoy · registro habilitado</span>
                        ) : future ? (
                          "Programada"
                        ) : (
                          "Dictada"
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular">{fmtRange(s.start_time, s.end_time)}</TableCell>
                    <TableCell>
                      {future ? (
                        <span className="text-xs text-muted-foreground">Aún no inicia</span>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-muted-foreground tabular">
                              {attended}/{s.enrolled} asistieron
                            </span>
                            <span className="font-medium tabular">{fmtPct(Math.round(rate * 10) / 10)}</span>
                          </div>
                          <AttendanceBar
                            pending={isToday}
                            counts={{ present: s.present, late: s.late, excused: s.excused, absent: s.absent }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant={isToday ? "default" : "outline"} size="sm" asChild>
                          <Link href={`/admin/sesiones/${s.id}`}>
                            Abrir <ArrowRightIcon />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
                              <DotsThreeVerticalIcon weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(s)}>
                              <TrashIcon />
                              Eliminar sesión
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmModal
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="¿Eliminar esta sesión?"
        description="Se eliminarán también todos los registros de asistencia asociados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar sesión"
        loading={del.isPending}
        onConfirm={() =>
          toDelete &&
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Sesión eliminada")
              setToDelete(null)
            },
            onError: (e) => toast.error(e.message),
          })
        }
      />
    </>
  )
}
