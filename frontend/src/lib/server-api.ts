/**
 * Acceso a la API desde Server Components. El servidor de Next.js está en la misma red
 * que la API, así que estas llamadas no cruzan internet: la página llega con los datos.
 */
import { QueryClient } from "@tanstack/react-query"
import { cookies } from "next/headers"

import { apiPath, qk } from "@/lib/query-keys"
import { API_URL, COURSE_COOKIE, TOKEN_COOKIE } from "@/lib/session"
import type { Course } from "@/lib/types"

export async function serverGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`API ${res.status} en ${path}`)
  return (await res.json()) as T
}

export function createServerQueryClient() {
  // Mismo staleTime que el cliente: lo precargado no se vuelve a pedir al hidratar.
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } })
}

export function prefetch(qc: QueryClient, queryKey: readonly unknown[], path: string) {
  return qc.prefetchQuery({ queryKey, queryFn: () => serverGet(path) })
}

/** Programa activo: el de la cookie si existe y es válido; si no, el primero. */
export async function activeCourseId(qc: QueryClient): Promise<string | undefined> {
  const [courses, store] = await Promise.all([
    qc.ensureQueryData({ queryKey: qk.courses, queryFn: () => serverGet<Course[]>(apiPath.courses) })
      .catch(() => [] as Course[]),
    cookies(),
  ])
  const saved = store.get(COURSE_COOKIE)?.value
  return courses.find((c) => c.id === saved)?.id ?? courses[0]?.id
}
