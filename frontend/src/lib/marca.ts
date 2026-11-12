"use client"

import { useSyncExternalStore } from "react"

export interface Marca {
  institucion: string | null
  sigla: string | null
}

const SIN_MARCA: Marca = { institucion: null, sigla: null }

let actual: Marca | null = null
let pedido: Promise<void> | null = null
const oyentes = new Set<() => void>()

function cargar() {
  pedido ??= fetch("/api/marca")
    .then((r) => (r.ok ? (r.json() as Promise<Marca>) : SIN_MARCA))
    .catch(() => SIN_MARCA)
    .then((m) => {
      actual = m
      for (const oyente of oyentes) oyente()
    })
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  cargar()
  return () => oyentes.delete(oyente)
}

/** Marca de la instalación; `null` mientras se carga. */
export function useMarca(): Marca | null {
  return useSyncExternalStore(
    suscribir,
    () => actual,
    () => null
  )
}

export function marcaActual(): Marca {
  return actual ?? SIN_MARCA
}
