"use client"

import {
  ArrowLeftIcon,
  CalendarBlankIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  UserCircleCheckIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useCrumb } from "@/components/app-shell/breadcrumb-store"
import { STATUS_META } from "@/components/attendance/status-badge"
import { StatusSelect } from "@/components/attendance/status-select"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  fmtDay,
  fmtLongDay,
  fmtRange,
  fmtStamp,
  initials,
  todayISO,
} from "@/lib/format"
import { useMatrix, useSetAttendance } from "@/lib/queries"
import type { AttendanceStatus, MatrixRow } from "@/lib/types"
import { cn } from "@/lib/utils"

type Filter = "all" | AttendanceStatus | "pending"

function NoteEditor({ row, sessionId }: { row: MatrixRow; sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState(row.note ?? "")
  const mutation = useSetAttendance()
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setNote(row.note ?? "")
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Nota"
              className={cn(row.note && "text-primary")}
            >
              <NotePencilIcon weight={row.note ? "fill" : "regular"} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{row.note ?? "Agregar nota"}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">Nota del registro</div>
          <p className="text-xs text-muted-foreground">
            Se guarda junto al estado actual ({STATUS_LABEL[row.status]}).
          </p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Ej. Presentó certificado médico"
          className="min-h-20"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { sessionId, studentId: row.student_id, status: row.status, note: note || null },
                {
                  onSuccess: () => {
                    toast.success("Nota guardada")
                    setOpen(false)
                  },
                  onError: (e) => toast.error(e.message),
                }
              )
            }
          >
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useMatrix(id)
  const setAttendance = useSetAttendance()
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const session = data?.session
  useCrumb(`/admin/sesiones/${id}`, session ? fmtDay(session.session_date) : undefined)
  const isFuture = session ? session.session_date > todayISO() : false
  const open = session ? session.is_today || isFuture : false

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, excused: 0, absent: 0, pending: 0 }
    for (const r of data?.rows ?? []) {
      if (!r.recorded) c.pending += 1
      else c[r.status] += 1
    }
    return c
  }, [data])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data?.rows ?? []).filter((r) => {
      if (filter === "pending" && r.recorded) return false
      if (filter !== "all" && filter !== "pending" && (!r.recorded || r.status !== filter))
        return false
      if (!term) return true
      return (
        r.full_name.toLowerCase().includes(term) ||
        r.registration_code.includes(term) ||
        (r.email ?? "").toLowerCase().includes(term)
      )
    })
  }, [data, q, filter])

  function change(row: MatrixRow, status: AttendanceStatus) {
    setAttendance.mutate(
      { sessionId: id, studentId: row.student_id, status, note: row.note },
      {
        onSuccess: () =>
          toast.success(`${row.full_name.split(" ")[0]}: ${STATUS_LABEL[status].toLowerCase()}`),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const stats: { key: Filter; label: string; value: number; dot: string }[] = [
    { key: "present", label: "Presentes", value: counts.present, dot: STATUS_META.present.dot },
    { key: "late", label: "Tarde", value: counts.late, dot: STATUS_META.late.dot },
    { key: "excused", label: "Justificados", value: counts.excused, dot: STATUS_META.excused.dot },
    { key: "absent", label: "Faltas", value: counts.absent, dot: STATUS_META.absent.dot },
    { key: "pending", label: open ? "Sin registro" : "Sin registro (falta)", value: counts.pending, dot: "bg-muted-foreground/40" },
  ]

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/admin/sesiones">
          <ArrowLeftIcon />
          Sesiones
        </Link>
      </Button>
      {isLoading || !session ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow={
              <span className="flex items-center gap-2">
                Control de asistencia · {session.course_code}
                {session.is_today ? (
                  <Badge className="gap-1.5 bg-primary/10 text-primary normal-case">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                    Hoy
                  </Badge>
                ) : isFuture ? (
                  <Badge variant="outline" className="normal-case">Programada</Badge>
                ) : (
                  <Badge variant="secondary" className="normal-case">Dictada</Badge>
                )}
              </span>
            }
            title={session.topic ?? "Sesión sin tema"}
            description={
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarBlankIcon className="size-4" /> {fmtLongDay(session.session_date)}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <ClockIcon className="size-4" /> {fmtRange(session.start_time, session.end_time)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UsersIcon className="size-4" /> {session.enrolled} inscritos
                </span>
              </span>
            }
          />

          {isFuture && (
            <Alert className="mb-4">
              <CalendarBlankIcon />
              <AlertTitle>Esta sesión aún no se dicta</AlertTitle>
              <AlertDescription>
                La asistencia se podrá registrar o modificar a partir del {fmtLongDay(session.session_date)}.
                Mientras tanto, la lista es de solo lectura.
              </AlertDescription>
            </Alert>
          )}

          <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-5", isFuture && "hidden")}>
            {stats.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(filter === s.key ? "all" : s.key)}
                className={cn(
                  "rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40",
                  filter === s.key && "border-primary ring-2 ring-primary/15"
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", s.dot)} />
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular">{s.value}</div>
              </button>
            ))}
          </div>

          <Card className="mt-4 gap-0 overflow-hidden py-0">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
              <InputGroup className="h-9 lg:max-w-sm">
                <InputGroupAddon>
                  <MagnifyingGlassIcon />
                </InputGroupAddon>
                <InputGroupInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre, registro o correo"
                />
              </InputGroup>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                className={cn("flex-wrap", isFuture && "hidden")}
                value={filter}
                onValueChange={(v) => setFilter((v || "all") as Filter)}
              >
                <ToggleGroupItem value="all">Todos</ToggleGroupItem>
                <ToggleGroupItem value="present">Presentes</ToggleGroupItem>
                <ToggleGroupItem value="late">Tarde</ToggleGroupItem>
                <ToggleGroupItem value="excused">Justificados</ToggleGroupItem>
                <ToggleGroupItem value="absent">Faltas</ToggleGroupItem>
                <ToggleGroupItem value="pending">Sin registro</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 pl-4">#</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Hora de marcado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="w-12 text-center">Nota</TableHead>
                  <TableHead className="pr-4 text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.student_id} className="group">
                    <TableCell className="pl-4 text-xs text-muted-foreground tabular">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-accent text-[11px] font-semibold text-accent-foreground">
                            {initials(r.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/estudiantes/${r.student_id}`}
                            className="block truncate font-medium hover:text-primary hover:underline"
                          >
                            {r.full_name}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">{r.email ?? "—"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.registration_code}</TableCell>
                    <TableCell className="font-mono text-xs tabular">{fmtStamp(r.marked_at)}</TableCell>
                    <TableCell>
                      {r.source ? (
                        <Badge variant="outline" className="gap-1 font-normal">
                          {r.source === "self" && <UserCircleCheckIcon className="text-primary" />}
                          {SOURCE_LABEL[r.source]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isFuture ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <NoteEditor row={r} sessionId={id} />
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {isFuture ? (
                        <Badge variant="outline" className="font-normal">
                          Programada
                        </Badge>
                      ) : (
                        <StatusSelect
                          className="ml-auto"
                          value={r.status}
                          recorded={r.recorded}
                          placeholder={open ? "Sin registro" : "Falta (sin registro)"}
                          disabled={setAttendance.isPending}
                          onChange={(s) => change(r, s)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length === 0 && (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyTitle>Sin resultados</EmptyTitle>
                  <EmptyDescription>Ningún estudiante coincide con el filtro aplicado.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </Card>
        </>
      )}
    </>
  )
}
