import type { Metadata } from "next"
import { Suspense } from "react"

import { HistoryView } from "@/app/(app)/estudiante/historial/history-view"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Historial" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hydrate prefetch={(qc) => prefetch(qc, qk.myAttendance, apiPath.myAttendance)}>
        <HistoryView />
      </Hydrate>
    </Suspense>
  )
}
