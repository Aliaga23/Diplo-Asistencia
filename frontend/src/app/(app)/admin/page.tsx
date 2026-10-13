"use client"

import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  ChartDonutIcon,
  ClockIcon,
  DownloadSimpleIcon,
  UsersThreeIcon,
  WarningDiamondIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { toast } from "sonner"

import { useCourse } from "@/components/app-shell/course-context"
import { PageHeader } from "@/components/common/page-header"
import { KpiCard } from "@/components/common/kpi-card"
import { AttendanceChart } from "@/components/dashboard/attendance-chart"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { downloadFile } from "@/lib/api"
import { fmtLongDay, fmtPct, fmtRange, initials, shortName } from "@/lib/format"
import { useDashboard, useStudents } from "@/lib/queries"

export default function AdminDashboardPage() {
  const { course } = useCourse()
  const { data, isLoading } = useDashboard(course?.id)
  const { data: students } = useStudents(course?.id)

  const atRisk = (students ?? [])
    .filter((s) => s.sessions_total > 0 && s.attendance_rate < 80)
    .sort((a, b) => a.attendance_rate - b.attendance_rate)
    .slice(0, 6)

  const today = data?.today_session
  const marked = (data?.today_present ?? 0) + (data?.today_late ?? 0)
  const todayPct = today && today.enrolled ? Math.round((marked / today.enrolled) * 100) : 0

  async function exportXlsx() {
    try {
      await downloadFile(`/reports/attendance.xlsx?course_id=${course?.id}`, "asistencia.xlsx")
      toast.success("Reporte exportado")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={course ? `${course.code} · ${course.period}` : undefined}
        title="Panel de asistencia"
        description="Resumen en tiempo real del programa activo: sesiones dictadas, tasa de asistencia y estudiantes que requieren seguimiento."
        actions={
          <>
            <Button variant="outline" onClick={exportXlsx} disabled={!course}>
              <DownloadSimpleIcon />
              Exportar Excel
            </Button>
            <Button asChild>
              <Link href="/admin/sesiones">
                <CalendarCheckIcon />
                Ver sesiones
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          accent
          label="Asistencia promedio"
          icon={ChartDonutIcon}
          loading={isLoading}
          value={data ? fmtPct(data.attendance_rate) : "—"}
          hint="Presentes y tardanzas sobre sesiones dictadas"
        >
          <Progress value={data?.attendance_rate ?? 0} className="h-1.5 bg-white/10" />
        </KpiCard>
        <KpiCard
          label="Estudiantes inscritos"
          icon={UsersThreeIcon}
          loading={isLoading}
          value={data?.students_total ?? "—"}
          hint={`${atRisk.length} con asistencia menor a 80%`}
        />
        <KpiCard
          label="Sesiones dictadas"
          icon={CalendarCheckIcon}
          loading={isLoading}
          value={
            data ? (
              <>
                {data.sessions_done}
                <span className="text-lg text-muted-foreground"> / {data.sessions_total}</span>
              </>
            ) : (
              "—"
            )
          }
          hint={data ? `${data.sessions_total - data.sessions_done} sesiones programadas` : ""}
        />
        <KpiCard
          label="Registros de hoy"
          icon={ClockIcon}
          loading={isLoading}
          value={today ? `${marked}/${today.enrolled}` : "—"}
          hint={today ? `${data?.today_pending} pendientes de registrar` : "No hay clase programada hoy"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Asistencia por sesión</CardTitle>
            <CardDescription>Distribución de estados en las últimas sesiones dictadas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : data && data.series.length > 0 ? (
              <AttendanceChart data={data.series} />
            ) : (
              <Empty className="h-[280px] border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarXIcon />
                  </EmptyMedia>
                  <EmptyTitle>Aún no hay sesiones dictadas</EmptyTitle>
                  <EmptyDescription>Importa los horarios del programa para comenzar.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="relative">
            <CardTitle>Sesión de hoy</CardTitle>
            <CardDescription>{data ? fmtLongDay(data.server_now.slice(0, 10)) : " "}</CardDescription>
            {today && (
              <CardAction>
                <Badge className="gap-1.5 bg-primary/10 text-primary">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  En curso hoy
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="relative">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : today ? (
              <div className="space-y-5">
                <div>
                  <div className="font-mono text-2xl font-semibold tracking-tight">
                    {fmtRange(today.start_time, today.end_time)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{today.topic ?? "Sin tema"}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Registrados</span>
                    <span className="font-medium tabular">{todayPct}%</span>
                  </div>
                  <Progress value={todayPct} className="h-2" />
                </div>
                <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card text-center">
                  {[
                    { k: "Presentes", v: data?.today_present, c: "text-status-present" },
                    { k: "Tarde", v: data?.today_late, c: "text-[oklch(0.55_0.13_62)] dark:text-status-late" },
                    { k: "Pendientes", v: data?.today_pending, c: "text-muted-foreground" },
                  ].map((x) => (
                    <div key={x.k} className="py-3">
                      <dd className={`text-xl font-semibold tabular ${x.c}`}>{x.v}</dd>
                      <dt className="text-[11px] text-muted-foreground">{x.k}</dt>
                    </div>
                  ))}
                </dl>
                <Button asChild className="w-full">
                  <Link href={`/admin/sesiones/${today.id}`}>
                    Abrir control de asistencia
                    <ArrowRightIcon weight="bold" />
                  </Link>
                </Button>
              </div>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarXIcon />
                  </EmptyMedia>
                  <EmptyTitle>Sin clases hoy</EmptyTitle>
                  <EmptyDescription>No hay sesiones programadas para la fecha actual.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WarningDiamondIcon weight="duotone" className="size-5 text-status-absent" />
            Estudiantes que requieren seguimiento
          </CardTitle>
          <CardDescription>Asistencia acumulada menor al 80% sobre las sesiones dictadas</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/estudiantes">
                Ver todos <ArrowRightIcon />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {atRisk.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todos los estudiantes tienen asistencia igual o superior al 80%.
            </p>
          ) : (
            <ul className="grid gap-x-8 gap-y-1 md:grid-cols-2">
              {atRisk.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/estudiantes/${s.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60"
                  >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(s.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{shortName(s.full_name)}</div>
                    <div className="text-xs text-muted-foreground tabular">
                      {s.absent} faltas · {s.late} tardanzas · Reg. {s.registration_code}
                    </div>
                  </div>
                  <div className="w-28 space-y-1 text-right">
                    <div className="text-sm font-semibold tabular text-status-absent">
                      {fmtPct(s.attendance_rate)}
                    </div>
                    <Progress
                      value={s.attendance_rate}
                      className="h-1 [&>[data-slot=progress-indicator]]:bg-status-absent"
                    />
                  </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
