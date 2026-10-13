import type { Metadata } from "next"
import { Suspense } from "react"

import { ImportsView } from "@/app/(app)/admin/importaciones/imports-view"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Importaciones" }

export default function ImportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hydrate prefetch={(qc) => prefetch(qc, qk.imports, apiPath.imports)}>
        <ImportsView />
      </Hydrate>
    </Suspense>
  )
}
