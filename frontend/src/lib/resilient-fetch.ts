/**
 * fetch del navegador tolerante a cortes de red entre Cloudflare y el servidor.
 *
 * Reintenta solo cuando la petición NO llegó a la aplicación: error de red o respuestas
 * de Cloudflare/Traefik sin conexión con el origen (502, 503, 521, 522, 523). En esos
 * casos repetirla es seguro aunque sea un POST.
 */

const SIN_ORIGEN = new Set([502, 503, 521, 522, 523])
const ESPERAS_MS = [700, 1800]

export const MENSAJE_SIN_SERVIDOR =
  "El servidor no responde en este momento. Revisa tu conexión e intenta nuevamente."

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function resilientFetch(input: string, init?: RequestInit): Promise<Response> {
  for (let intento = 0; ; intento++) {
    try {
      const res = await fetch(input, init)
      if (!SIN_ORIGEN.has(res.status) || intento >= ESPERAS_MS.length) return res
    } catch (error) {
      if (intento >= ESPERAS_MS.length) throw error
    }
    await esperar(ESPERAS_MS[intento])
  }
}

/** Lee el campo `detail` de una respuesta de la app; si no es JSON propio, da un mensaje claro. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === "string") return data.detail
  } catch {
    /* página de error de Cloudflare o del proxy (HTML) */
  }
  return res.status >= 500 ? MENSAJE_SIN_SERVIDOR : fallback
}
