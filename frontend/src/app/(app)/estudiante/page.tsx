import type { Metadata } from "next"
import { Suspense } from "react"

import { TodayView } from "@/app/(app)/estudiante/today-view"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Mi asistencia" }

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hydrate prefetch={(qc) => prefetch(qc, qk.myAttendance, apiPath.myAttendance)}>
        <TodayView />
      </Hydrate>
    </Suspense>
  )
}
