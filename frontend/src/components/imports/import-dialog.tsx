"use client"

import {
  CheckCircleIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  FileXlsIcon,
  MicrosoftExcelLogoIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { useCourse } from "@/components/app-shell/course-context"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/common/modal"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { downloadFile } from "@/lib/api"
import { useImportFile } from "@/lib/queries"
import type { ImportBatch, ImportKind } from "@/lib/types"
import { cn } from "@/lib/utils"

export const IMPORT_SPEC: Record<
  ImportKind,
  {
    title: string
    description: string
    modelName: string
    columns: { name: string; required: boolean; hint: string }[]
  }
> = {
  students: {
    title: "Importar estudiantes",
    description:
      "Crea las cuentas y las inscribe al programa. Cada estudiante ingresa con su número de registro y la contraseña común.",
    modelName: "modelo_estudiantes.xlsx",
    columns: [
      { name: "registro", required: true, hint: "Número de registro (usuario de ingreso)" },
      { name: "nombre", required: true, hint: "Nombre completo" },
      { name: "email", required: false, hint: "Correo institucional" },
      { name: "carrera", required: false, hint: "Carrera o especialidad" },
    ],
  },
  sessions: {
    title: "Importar horarios y fechas",
    description:
      "Registra las sesiones de clase del programa. Si una fecha y hora de inicio ya existe, se actualiza.",
    modelName: "modelo_horarios.xlsx",
    columns: [
      { name: "fecha", required: true, hint: "AAAA-MM-DD o DD/MM/AAAA" },
      { name: "hora_inicio", required: true, hint: "HH:MM (24 h)" },
      { name: "hora_fin", required: true, hint: "HH:MM, posterior al inicio" },
      { name: "tema", required: false, hint: "Contenido de la sesión" },
    ],
  },
}

export async function downloadModel(kind: ImportKind) {
  try {
    await downloadFile(`/imports/templates/${kind}`, IMPORT_SPEC[kind].modelName)
    toast.success("Modelo descargado. Complétalo y súbelo en el paso 2.")
  } catch (e) {
    toast.error((e as Error).message)
  }
}

export function ImportResult({ batch }: { batch: ImportBatch }) {
  const ok = batch.rows_failed === 0
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-3",
          ok ? "border-primary/30 bg-primary/5" : "border-status-late/40 bg-status-late/8"
        )}
      >
        {ok ? (
          <CheckCircleIcon weight="fill" className="mt-0.5 size-5 text-primary" />
        ) : (
          <WarningIcon weight="fill" className="mt-0.5 size-5 text-status-late" />
        )}
        <div className="text-sm">
          <div className="font-medium">
            {batch.rows_ok} de {batch.rows_total} filas procesadas correctamente
          </div>
          <div className="text-muted-foreground">
            {ok ? "El archivo no tuvo errores." : `${batch.rows_failed} filas con observaciones.`}
          </div>
        </div>
      </div>
      {batch.errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl border">
          <ul className="divide-y text-sm">
            {batch.errors.map((e) => (
              <li key={`${e.row}-${e.message}`} className="flex gap-3 px-3 py-2">
                <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">Fila {e.row}</span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="relative pl-10">
      <div
        className={cn(
          "absolute top-0 left-0 flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
          done ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"
        )}
      >
        {done ? <CheckCircleIcon weight="bold" className="size-4" /> : n}
      </div>
      <h3 className="mb-3 pt-1 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

export function ImportDialog({
  kind,
  trigger,
}: {
  kind: ImportKind
  /** Renderiza el botón que abre el modal. */
  trigger: (open: () => void) => React.ReactNode
}) {
  const spec = IMPORT_SPEC[kind]
  const { course } = useCourse()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const [modelDone, setModelDone] = useState(false)
  const [result, setResult] = useState<ImportBatch | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const mutation = useImportFile(kind)

  function onOpenChange(o: boolean) {
    setOpen(o)
    if (!o) {
      setFile(null)
      setResult(null)
      mutation.reset()
    }
  }

  function pick(f: File | undefined) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Selecciona un archivo Excel (.xlsx) basado en el modelo")
      return
    }
    setResult(null)
    setFile(f)
  }

  function submit() {
    if (!file || !course) return
    mutation.mutate(
      { courseId: course.id, file },
      {
        onSuccess: (batch) => {
          setResult(batch)
          setFile(null)
          toast.success(`Importación completada: ${batch.rows_ok} filas`)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal open={open} onOpenChange={onOpenChange} size="lg">
        <ModalHeader
          icon={MicrosoftExcelLogoIcon}
          title={spec.title}
          description={
            <>
              {spec.description}
              {course && (
                <>
                  {" "}
                  Programa destino: <span className="font-medium text-foreground">{course.code}</span>.
                </>
              )}
            </>
          }
        />
        <ModalBody className="space-y-7">
          <Step n={1} title="Descarga el modelo y complétalo" done={modelDone}>
            <div className="overflow-hidden rounded-xl border">
              <div className="flex flex-col gap-3 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center">
                <FileXlsIcon weight="duotone" className="size-8 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-medium">{spec.modelName}</div>
                  <div className="text-xs text-muted-foreground">
                    Incluye encabezados, filas de ejemplo y una hoja de instrucciones.
                  </div>
                </div>
                <Button
                  data-autofocus
                  variant={modelDone ? "outline" : "default"}
                  onClick={async () => {
                    await downloadModel(kind)
                    setModelDone(true)
                  }}
                >
                  <DownloadSimpleIcon weight="bold" />
                  Descargar modelo
                </Button>
              </div>
              <table className="w-full text-xs">
                <thead className="border-y bg-card text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Columna</th>
                    <th className="px-4 py-2 text-left font-medium">Contenido</th>
                    <th className="px-4 py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {spec.columns.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-2 font-mono font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.hint}</td>
                      <td className="px-4 py-2 text-right">
                        {c.required ? (
                          <span className="text-[10px] font-semibold text-primary uppercase">Obligatoria</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground uppercase">Opcional</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Step>

          <Step n={2} title="Sube el archivo completado" done={!!result}>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                pick(e.dataTransfer.files[0])
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors",
                drag ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <CloudArrowUpIcon weight="duotone" className="size-6" />
              </div>
              <div className="text-sm font-medium">Arrastra el archivo o haz clic para seleccionarlo</div>
              <div className="text-xs text-muted-foreground">Formato .xlsx · máximo 5 MB</div>
            </button>
            <input
              ref={input}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            {file && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2">
                <FileXlsIcon weight="duotone" className="size-6 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="Quitar archivo">
                  <XIcon />
                </Button>
              </div>
            )}
            {result && (
              <div className="mt-3">
                <ImportResult batch={result} />
              </div>
            )}
          </Step>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          <Button onClick={submit} disabled={!file || !course || mutation.isPending}>
            {mutation.isPending && <Spinner />}
            Importar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
