"use client"

import { CalendarCheckIcon, LockSimpleIcon, PencilSimpleIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { StatusBadge } from "@/components/attendance/status-badge"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SOURCE_LABEL, fmtDay, fmtRange, fmtStamp, todayISO } from "@/lib/format"
import { useMyAttendance } from "@/lib/queries"

type Tab = "past" | "upcoming"

export default function StudentHistoryPage() {
  const { data, isLoading } = useMyAttendance()
  const [tab, setTab] = useState<Tab>("past")
  const today = todayISO()

  const rows = useMemo(() => {
    const h = data?.history ?? []
    return tab === "past"
      ? h.filter((x) => x.session.session_date <= today)
      : [...h.filter((x) => x.session.session_date > today)].reverse()
  }, [data, tab, today])

  return (
    <>
      <PageHeader
        eyebrow="Mi asistencia"
        title="Historial"
        description="Detalle de tu asistencia en cada sesión de tus programas."
        actions={
          <Button asChild>
            <Link href="/estudiante">
              <CalendarCheckIcon />
              Registrar hoy
            </Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="past">Dictadas</TabsTrigger>
          <TabsTrigger value="upcoming">Programadas</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-4">Fecha</TableHead>
                <TableHead>Programa</TableHead>
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
                  <TableRow key={h.session.id} className={isToday ? "bg-primary/[0.04]" : ""}>
                    <TableCell className="pl-4 font-medium">
                      <div className="flex items-center gap-2">
                        {fmtDay(h.session.session_date)}
                        {isToday && <Badge className="h-4 bg-primary/10 px-1.5 text-[10px] text-primary">Hoy</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono font-normal">
                        {h.session.course_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">{h.session.topic}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtRange(h.session.start_time, h.session.end_time)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtStamp(h.marked_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.source ? SOURCE_LABEL[h.source] : "—"}
                      {h.note && (
                        <Tooltip>
                          <TooltipTrigger className="ml-1 underline decoration-dotted">nota</TooltipTrigger>
                          <TooltipContent>{h.note}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {future ? (
                          <Badge variant="outline" className="font-normal">Programada</Badge>
                        ) : (
                          <StatusBadge status={h.status} muted={isToday && !h.recorded} />
                        )}
                        {!future &&
                          (h.editable ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link href="/estudiante" className="text-primary" aria-label="Editable hoy">
                                  <PencilSimpleIcon />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>Puedes modificarlo durante el día de hoy</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger aria-label="Bloqueado">
                                <LockSimpleIcon className="text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>Solo el administrador puede modificar fechas anteriores</TooltipContent>
                            </Tooltip>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  )
}
