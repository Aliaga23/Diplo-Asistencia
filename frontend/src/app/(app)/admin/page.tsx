import type { Metadata } from "next"
import { Suspense } from "react"

import { DashboardView } from "@/app/(app)/admin/dashboard-view"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { activeCourseId, prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Panel" }

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hydrate
        prefetch={async (qc) => {
          const id = await activeCourseId(qc)
          if (!id) return
          await Promise.all([
            prefetch(qc, qk.dashboard(id), apiPath.dashboard(id)),
            prefetch(qc, qk.students(id, undefined), apiPath.students(id)),
          ])
        }}
      >
        <DashboardView />
      </Hydrate>
    </Suspense>
  )
}
