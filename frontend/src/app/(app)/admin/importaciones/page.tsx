"use client"

import {
  CalendarDotsIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
  FileArrowUpIcon,
  ListMagnifyingGlassIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { useState } from "react"

import { useCourse } from "@/components/app-shell/course-context"
import { PageHeader } from "@/components/common/page-header"
import { Modal, ModalBody, ModalHeader } from "@/components/common/modal"
import { IMPORT_SPEC, ImportDialog, ImportResult, downloadModel } from "@/components/imports/import-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtDateTime } from "@/lib/format"
import { useImports } from "@/lib/queries"
import type { ImportBatch, ImportKind } from "@/lib/types"

const CARDS: { kind: ImportKind; icon: typeof UsersThreeIcon }[] = [
  { kind: "students", icon: UsersThreeIcon },
  { kind: "sessions", icon: CalendarDotsIcon },
]

export default function ImportsPage() {
  const { data, isLoading } = useImports()
  const { courses } = useCourse()
  const [detail, setDetail] = useState<ImportBatch | null>(null)

  return (
    <>
      <PageHeader
        title="Importaciones"
        description="Carga masiva desde Excel con validación fila por fila. Cada importación queda registrada para auditoría."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map(({ kind, icon: Icon }) => {
          const spec = IMPORT_SPEC[kind]
          return (
            <Card key={kind} className="relative overflow-hidden">
              <CardHeader className="relative">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon weight="duotone" className="size-5" />
                </div>
                <CardTitle>{spec.title}</CardTitle>
                <CardDescription>{spec.description}</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex flex-wrap gap-1.5">
                  {spec.columns.map((c) => (
                    <Badge key={c.name} variant={c.required ? "default" : "outline"} className="font-mono font-normal">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="relative gap-2">
                <Button variant="outline" onClick={() => downloadModel(kind)}>
                  <DownloadSimpleIcon />
                  Descargar modelo
                </Button>
                <ImportDialog
                  kind={kind}
                  trigger={(open) => (
                    <Button onClick={open}>
                      <FileArrowUpIcon />
                      Importar
                    </Button>
                  )}
                />
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4 gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Historial de importaciones</CardTitle>
          <CardDescription>Registro de auditoría de cada archivo procesado</CardDescription>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileArrowUpIcon />
              </EmptyMedia>
              <EmptyTitle>Sin importaciones todavía</EmptyTitle>
              <EmptyDescription>Los archivos que subas aparecerán aquí.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-4">Archivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Filas</TableHead>
                <TableHead className="text-right">Correctas</TableHead>
                <TableHead className="text-right">Con error</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="pl-4 font-medium">{b.filename}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {b.kind === "students" ? "Estudiantes" : "Horarios"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {courses.find((c) => c.id === b.course_id)?.code ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDateTime(b.created_at)}</TableCell>
                  <TableCell className="text-right tabular">{b.rows_total}</TableCell>
                  <TableCell className="text-right tabular">
                    <span className="inline-flex items-center gap-1 text-primary">
                      <CheckCircleIcon weight="fill" /> {b.rows_ok}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {b.rows_failed > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[oklch(0.55_0.13_62)] dark:text-status-late">
                        <WarningIcon weight="fill" /> {b.rows_failed}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(b)}>
                      <ListMagnifyingGlassIcon />
                      Detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && (
          <>
            <ModalHeader
              icon={ListMagnifyingGlassIcon}
              title={detail.filename}
              description={`${detail.kind === "students" ? "Estudiantes" : "Horarios"} · ${fmtDateTime(detail.created_at)}`}
            />
            <ModalBody>
              <ImportResult batch={detail} />
            </ModalBody>
          </>
        )}
      </Modal>
    </>
  )
}
