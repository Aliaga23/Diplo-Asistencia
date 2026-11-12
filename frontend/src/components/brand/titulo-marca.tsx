"use client"

import { useEffect } from "react"

import { useMarca } from "@/lib/marca"

/** Agrega la sigla de la institución al título de la pestaña, también cuando cambia de página. */
export function TituloMarca() {
  const marca = useMarca()
  useEffect(() => {
    const sigla = marca?.sigla
    if (!sigla) return
    const aplicar = () => {
      if (!document.title.includes(`Presencia ${sigla}`)) {
        document.title = document.title.replace(/Presencia/g, `Presencia ${sigla}`)
      }
    }
    aplicar()
    const observador = new MutationObserver(aplicar)
    observador.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => observador.disconnect()
  }, [marca])
  return null
}
