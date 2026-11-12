export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

function mensaje(datos: unknown, status: number): string {
  const detalle = (datos as { detail?: unknown })?.detail
  if (typeof detalle === "string") return detalle
  if (Array.isArray(detalle)) {
    return detalle.map((d: { loc?: string[]; msg?: string }) => `${d.loc?.at(-1)}: ${d.msg}`).join(" · ")
  }
  return `Error ${status}`
}

export async function api<T>(ruta: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...resto } = init ?? {}
  const res = await fetch(`/api/plataforma${ruta}`, {
    ...resto,
    headers: json === undefined ? resto.headers : { "Content-Type": "application/json" },
    body: json === undefined ? resto.body : JSON.stringify(json),
    cache: "no-store",
  })
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
  }
  const datos = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(mensaje(datos, res.status), res.status)
  return datos as T
}
