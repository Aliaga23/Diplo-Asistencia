/**
 * Cliente HTTP del navegador. Todas las llamadas pasan por el BFF de Next
 * (`/api/backend/*`), que adjunta el JWT guardado en una cookie httpOnly.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type Json = Record<string, unknown> | unknown[]

function detailToMessage(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: (string | number)[] }
    const field = first.loc?.slice(-1)[0]
    return field ? `${field}: ${first.msg}` : (first.msg ?? "Datos inválidos")
  }
  return "Ocurrió un error inesperado"
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
    cache: "no-store",
  })
  if (res.status === 401 && typeof window !== "undefined") {
    // Recarga completa intencional: descarta la caché del cliente al expirar la sesión.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?expired=1"
    throw new ApiError(401, "Tu sesión expiró")
  }
  if (!res.ok) {
    let message = `Error ${res.status}`
    try {
      const body = await res.json()
      message = detailToMessage(body.detail)
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: Json) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: Json) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: Json) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<T>(path, { method: "POST", body: form })
  },
}

export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`/api/backend${path}`, { cache: "no-store" })
  if (!res.ok) throw new ApiError(res.status, "No se pudo descargar el archivo")
  const blob = await res.blob()
  const disposition = res.headers.get("Content-Disposition") ?? ""
  const match = /filename="?([^"]+)"?/.exec(disposition)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = match?.[1] ?? fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
