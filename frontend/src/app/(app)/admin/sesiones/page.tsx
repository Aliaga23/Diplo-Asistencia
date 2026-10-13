import type { Metadata } from "next"
import { Suspense } from "react"

import { SessionsView } from "@/app/(app)/admin/sesiones/sessions-view"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { activeCourseId, prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Sesiones" }

export default function SessionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hydrate
        prefetch={async (qc) => {
          const id = await activeCourseId(qc)
          if (id) await prefetch(qc, qk.sessions(id), apiPath.sessions(id))
        }}
      >
        <SessionsView />
      </Hydrate>
    </Suspense>
  )
}
