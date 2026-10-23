import { HydrationBoundary, dehydrate, type QueryClient } from "@tanstack/react-query"

import { createServerQueryClient } from "@/lib/server-api"

/**
 * Server Component: ejecuta la precarga y entrega los datos ya resueltos al cliente,
 * que los toma de su caché sin volver a pedirlos.
 */
export async function Hydrate({
  prefetch,
  children,
}: {
  prefetch: (qc: QueryClient) => Promise<unknown>
  children: React.ReactNode
}) {
  const qc = createServerQueryClient()
  await prefetch(qc).catch(() => undefined)
  return <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>
}
