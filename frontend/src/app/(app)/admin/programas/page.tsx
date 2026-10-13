"use client"

import {
  ArrowRightIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  GraduationCapIcon,
  PencilSimpleIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { useCourse } from "@/components/app-shell/course-context"
import { PageHeader } from "@/components/common/page-header"
import { ProgramModal } from "@/components/programs/program-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtPct } from "@/lib/format"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function ProgramsPage() {
  const router = useRouter()
  const { course: active, courses, setCourseId, isLoading } = useCourse()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)

  function openProgram(c: Course, to = "/admin") {
    setCourseId(c.id)
    router.push(to)
  }

  return (
    <>
      <PageHeader
        title="Programas"
        description="Gestiona el control de asistencia de cada programa académico. Cada uno tiene sus propios estudiantes, horarios e indicadores."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon weight="bold" />
            Nuevo programa
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GraduationCapIcon />
                </EmptyMedia>
                <EmptyTitle>Aún no hay programas</EmptyTitle>
                <EmptyDescription>Crea el primer programa para empezar a registrar asistencia.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setCreating(true)}>
                  <PlusIcon weight="bold" />
                  Nuevo programa
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => {
            const isActive = c.id === active?.id
            return (
              <Card key={c.id} className={cn("gap-0 transition-colors", isActive && "border-primary ring-2 ring-primary/15")}>
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl border bg-muted/60 text-primary">
                      <GraduationCapIcon weight="duotone" className="size-[22px]" />
                    </div>
                    <div className="flex items-center gap-1">
                      {isActive && (
                        <Badge className="gap-1 bg-primary/10 text-primary">
                          <CheckCircleIcon weight="fill" /> Activo
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon-sm" aria-label="Editar programa" onClick={() => setEditing(c)}>
                        <PencilSimpleIcon />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {c.code} · {c.period}
                    </div>
                    <h3 className="mt-1 text-base leading-snug font-semibold">{c.name}</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UsersThreeIcon /> Estudiantes
                      </div>
                      <div className="mt-0.5 text-xl font-semibold tabular">{c.students_count}</div>
                    </div>
                    <div className="rounded-lg border px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDotsIcon /> Sesiones
                      </div>
                      <div className="mt-0.5 text-xl font-semibold tabular">
                        {c.sessions_done}
                        <span className="text-sm font-normal text-muted-foreground"> / {c.sessions_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Asistencia promedio</span>
                      <span className="font-semibold tabular">{fmtPct(c.attendance_rate)}</span>
                    </div>
                    <Progress value={c.attendance_rate} className="h-1.5" />
                  </div>
                </CardContent>
                <CardFooter className="mt-5 gap-2 border-t pt-4">
                  <Button className="flex-1" onClick={() => openProgram(c)}>
                    Abrir panel <ArrowRightIcon />
                  </Button>
                  <Button variant="outline" onClick={() => openProgram(c, "/admin/sesiones")}>
                    Sesiones
                  </Button>
                  <Button variant="outline" onClick={() => openProgram(c, "/admin/estudiantes")}>
                    Estudiantes
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <ProgramModal open={creating} onOpenChange={setCreating} onSaved={(c) => setCourseId(c.id)} />
      <ProgramModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} program={editing} />
    </>
  )
}
