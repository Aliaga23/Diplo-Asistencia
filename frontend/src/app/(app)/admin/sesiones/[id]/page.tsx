import type { Metadata } from "next"
import { Suspense } from "react"

import { SessionDetail } from "@/app/(app)/admin/sesiones/[id]/session-detail"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Control de asistencia" }

export default function SessionDetailPage({ params }: PageProps<"/admin/sesiones/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <Hydrate prefetch={(qc) => prefetch(qc, qk.matrix(id), apiPath.matrix(id))}>
          <SessionDetail />
        </Hydrate>
      ))}
    </Suspense>
  )
}
