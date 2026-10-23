"use client"

import { CaretRightIcon, FileArrowUpIcon, MagnifyingGlassIcon, UsersThreeIcon } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useDeferredValue, useMemo, useState } from "react"

import { NewStudentDialog } from "@/app/(app)/admin/estudiantes/new-student-dialog"
import { useCourse } from "@/components/app-shell/course-context"
import { PageHeader } from "@/components/common/page-header"
import { ImportDialog } from "@/components/imports/import-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fmtPct, initials } from "@/lib/format"
import { useStudents } from "@/lib/queries"
import { cn } from "@/lib/utils"

type Segment = "all" | "risk" | "ok"

function rateTone(rate: number) {
  if (rate >= 80) return "[&>[data-slot=progress-indicator]]:bg-status-present"
  if (rate >= 60) return "[&>[data-slot=progress-indicator]]:bg-status-late"
  return "[&>[data-slot=progress-indicator]]:bg-status-absent"
}

export function StudentsView() {
  const { course } = useCourse()
  const [q, setQ] = useState("")
  const deferred = useDeferredValue(q)
  const [segment, setSegment] = useState<Segment>("all")
  const router = useRouter()
  const { data, isLoading, isFetching } = useStudents(course?.id, deferred.trim() || undefined)

  const rows = useMemo(() => {
    const list = data ?? []
    if (segment === "risk") return list.filter((s) => s.sessions_total > 0 && s.attendance_rate < 80)
    if (segment === "ok") return list.filter((s) => s.attendance_rate >= 80)
    return list
  }, [data, segment])

  return (
    <>
      <PageHeader
        eyebrow={course ? `${course.code} · ${course.period}` : undefined}
        title="Estudiantes"
        description="Estudiantes inscritos en el programa activo con su asistencia acumulada. Selecciona uno para ver su ficha y modificar su historial."
        actions={
          <>
            <ImportDialog
              kind="students"
              trigger={(open) => (
                <Button variant="outline" onClick={open}>
                  <FileArrowUpIcon />
                  Importar Excel
                </Button>
              )}
            />
            <NewStudentDialog />
          </>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <InputGroup className="h-9 md:max-w-sm">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, registro o correo"
            />
          </InputGroup>
          <div className="flex items-center gap-3">
            <span className={cn("text-xs text-muted-foreground tabular", isFetching && "animate-pulse")}>
              {rows.length} estudiantes
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={segment}
              onValueChange={(v) => setSegment((v || "all") as Segment)}
            >
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="ok">≥ 80%</ToggleGroupItem>
              <ToggleGroupItem value="risk">En riesgo</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersThreeIcon />
              </EmptyMedia>
              <EmptyTitle>No se encontraron estudiantes</EmptyTitle>
              <EmptyDescription>Ajusta la búsqueda o importa el listado desde Excel.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewStudentDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-4">Estudiante</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="hidden lg:table-cell">Carrera</TableHead>
                <TableHead className="w-[200px]">Asistencia</TableHead>
                <TableHead className="hidden text-center xl:table-cell">P · T · J · F</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/estudiantes/${s.id}`)}
                >
                  <TableCell className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                          {initials(s.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.full_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.email ?? "Sin correo"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.registration_code}</TableCell>
                  <TableCell className="hidden max-w-[220px] truncate text-sm text-muted-foreground lg:table-cell">
                    {s.career ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress value={s.attendance_rate} className={cn("h-1.5 flex-1", rateTone(s.attendance_rate))} />
                      <span className="w-12 text-right text-sm font-medium tabular">{fmtPct(s.attendance_rate)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-center font-mono text-xs text-muted-foreground tabular xl:table-cell">
                    {s.present} · {s.late} · {s.excused} · {s.absent}
                  </TableCell>
                  <TableCell>
                    {s.is_active ? (
                      <Badge variant="outline" className="gap-1.5 font-normal">
                        <span className="size-1.5 rounded-full bg-status-present" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <CaretRightIcon className="text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

    </>
  )
}
