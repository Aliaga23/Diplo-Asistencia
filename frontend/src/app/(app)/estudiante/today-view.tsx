"use client"

import {
  ArrowCounterClockwiseIcon,
  CalendarBlankIcon,
  CalendarXIcon,
  CheckCircleIcon,
  ClockIcon,
  FingerprintSimpleIcon,
  InfoIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "sonner"

import { STATUS_META, StatusBadge } from "@/components/attendance/status-badge"
import { ConfirmModal } from "@/components/common/confirm-modal"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { STATUS_LABEL, fmtDay, fmtLongDay, fmtPct, fmtRange, fmtStamp } from "@/lib/format"
import { useCancelMyAttendance, useMarkMyAttendance, useMe, useMyAttendance } from "@/lib/queries"
import type { AttendanceStatus, HistoryItem } from "@/lib/types"
import { cn } from "@/lib/utils"

function addMinutes(t: string, m: number) {
  const [h, mm] = t.split(":").map(Number)
  const total = h * 60 + mm + m
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function Ring({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        className="stroke-primary transition-[stroke-dashoffset] duration-700"
        strokeDasharray={c}
        strokeDashoffset={c - (Math.min(value, 100) / 100) * c}
      />
    </svg>
  )
}

function TodayCard({ item, tolerance }: { item: HistoryItem; tolerance: number }) {
  const mark = useMarkMyAttendance()
  const cancel = useCancelMyAttendance()
  const [confirming, setConfirming] = useState(false)
  const s = item.session
  const limit = addMinutes(s.start_time, tolerance)
  const byAdmin = item.recorded && item.source === "admin"

  function onMark() {
    mark.mutate(s.id, {
      onSuccess: (r) =>
        toast.success(r.status === "present" ? "Asistencia registrada" : "Asistencia registrada con tardanza", {
          description: `${s.course_code} · ${STATUS_LABEL[r.status]} a las ${fmtStamp(r.marked_at)}`,
        }),
      onError: (e) => toast.error("No se pudo registrar", { description: e.message }),
    })
  }

  function onCancel() {
    cancel.mutate(s.id, {
      onSuccess: () => {
        setConfirming(false)
        toast.info("Registro anulado", { description: "Puedes volver a registrarte durante el día de hoy." })
      },
      onError: (e) => toast.error("No se pudo anular", { description: e.message }),
    })
  }

  return (
    <Card className="relative overflow-hidden border-transparent bg-[oklch(0.17_0.02_264)] text-white dark:border-border dark:bg-[oklch(0.2_0.025_264)]">
      <CardContent className="relative grid gap-8 p-6 md:grid-cols-[1fr_auto] md:p-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
            <span className="size-1.5 animate-pulse rounded-full bg-[oklch(0.72_0.16_250)]" />
            Clase de hoy · {fmtLongDay(s.session_date)}
          </div>
          <div className="font-mono text-xs tracking-wide text-white/50 uppercase">
            {s.course_code} · {s.course_name}
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{s.topic ?? "Sesión de clase"}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/65">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <ClockIcon /> {fmtRange(s.start_time, s.end_time)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <InfoIcon /> Presente hasta las <span className="font-mono text-white">{limit}</span>, luego se registra
                como tarde
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!item.recorded ? (
              <Button
                size="lg"
                onClick={onMark}
                disabled={mark.isPending}
                className="h-12 bg-primary px-6 text-[15px] text-primary-foreground hover:bg-primary/90"
              >
                {mark.isPending ? <Spinner /> : <FingerprintSimpleIcon weight="bold" className="size-5" />}
                Registrar mi asistencia
              </Button>
            ) : byAdmin ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
                <LockSimpleIcon /> Registro confirmado por el administrador
              </span>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setConfirming(true)}
                className="h-11 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <ArrowCounterClockwiseIcon />
                Anular registro
              </Button>
            )}
          </div>
        </div>
        <div className="flex min-w-[220px] flex-col justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <span className="text-xs font-medium text-white/55 uppercase">Tu estado hoy</span>
          {item.recorded ? (
            <>
              <div className="flex items-center gap-2 text-2xl font-semibold">
                <CheckCircleIcon weight="fill" className={cn("size-7", STATUS_META[item.status].fg)} />
                {STATUS_LABEL[item.status]}
              </div>
              <span className="text-xs text-white/55">
                Registrado a las <span className="font-mono text-white/80">{fmtStamp(item.marked_at)}</span>
              </span>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold text-white/85">Pendiente</div>
              <span className="text-xs text-white/55">Aún no registraste tu asistencia</span>
            </>
          )}
        </div>
      </CardContent>
      <ConfirmModal
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Anular tu registro de hoy?"
        description={`Se eliminará tu asistencia en ${s.course_code}. Si vuelves a registrarte después de las ${limit}, quedará como tarde.`}
        confirmLabel="Anular registro"
        destructive
        loading={cancel.isPending}
        onConfirm={onCancel}
      />
    </Card>
  )
}

const BREAKDOWN: { key: AttendanceStatus; label: string }[] = [
  { key: "present", label: "Presente" },
  { key: "late", label: "Tarde" },
  { key: "excused", label: "Justificado" },
  { key: "absent", label: "Falta" },
]

export function TodayView() {
  const { data: me } = useMe()
  const { data, isLoading } = useMyAttendance()
  const firstName = me?.full_name.split(" ")[0]
  const next = data?.history
    .filter((h) => h.session.session_date > (data.server_now.slice(0, 10)))
    .sort((a, b) => a.session.session_date.localeCompare(b.session.session_date))
    .slice(0, 3)

  return (
    <>
      <PageHeader
        eyebrow="Mi asistencia"
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        description="Registra tu asistencia de la clase de hoy. Solo puedes registrar o modificar la asistencia del día actual."
      />

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data.today.length > 0 ? (
        <div className="space-y-4">
          {[...data.today]
            .sort((a, b) => a.session.start_time.localeCompare(b.session.start_time))
            .map((t) => (
            <TodayCard key={t.session.id} item={t} tolerance={data.late_tolerance_minutes} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarXIcon />
                </EmptyMedia>
                <EmptyTitle>No tienes clases hoy</EmptyTitle>
                <EmptyDescription>
                  {next && next.length > 0
                    ? `Tu próxima clase es el ${fmtDay(next[0].session.session_date, "EEEE d 'de' MMMM")}.`
                    : "No hay sesiones programadas próximamente."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Asistencia acumulada</CardTitle>
            <CardDescription>Sobre {data?.stats.sessions_total ?? 0} sesiones dictadas</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative">
              <Ring value={data?.stats.attendance_rate ?? 0} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold tabular">{data ? fmtPct(data.stats.attendance_rate) : "—"}</span>
                <span className="text-xs text-muted-foreground">asistencia</span>
              </div>
            </div>
            <ul className="grid w-full flex-1 grid-cols-2 gap-2">
              {BREAKDOWN.map((b) => (
                <li key={b.key} className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-2 rounded-full", STATUS_META[b.key].dot)} />
                    {b.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular">{data?.stats[b.key] ?? 0}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas clases</CardTitle>
            <CardDescription>Sesiones programadas de tus programas</CardDescription>
          </CardHeader>
          <CardContent>
            {next && next.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {next.map((h) => (
                  <li key={h.session.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <CalendarBlankIcon weight="duotone" className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{fmtDay(h.session.session_date, "EEEE d 'de' MMMM")}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{h.session.course_code}</span> · {h.session.topic}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {fmtRange(h.session.start_time, h.session.end_time)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No hay sesiones próximas.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data && data.history.some((h) => h.recorded && !h.editable) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Últimos registros</CardTitle>
            <CardDescription>Las fechas anteriores solo pueden ser modificadas por el administrador</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {data.history
                .filter((h) => h.session.session_date < data.server_now.slice(0, 10))
                .slice(0, 4)
                .map((h) => (
                  <li key={h.session.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                    <div className="text-sm">
                      <div className="font-medium">{fmtDay(h.session.session_date)}</div>
                      <div className="font-mono text-xs text-muted-foreground">{fmtStamp(h.marked_at)}</div>
                    </div>
                    <StatusBadge status={h.status} />
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}
