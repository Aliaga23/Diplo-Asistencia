"use client"

import { useEffect, useSyncExternalStore } from "react"

/**
 * Etiquetas dinámicas del breadcrumb (p. ej. el nombre de un estudiante en
 * /admin/estudiantes/[id]). Una página registra su etiqueta y el encabezado la muestra.
 */
const labels = new Map<string, string>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCrumbLabels(): ReadonlyMap<string, string> {
  useSyncExternalStore(subscribe, () => version, () => 0)
  return labels
}

export function useCrumb(href: string, label: string | undefined) {
  useEffect(() => {
    if (!label) return
    labels.set(href, label)
    emit()
    return () => {
      labels.delete(href)
      emit()
    }
  }, [href, label])
}
