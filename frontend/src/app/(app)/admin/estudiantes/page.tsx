import type { Metadata } from "next"
import { Suspense } from "react"

import { StudentsView } from "@/app/(app)/admin/estudiantes/students-view"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { activeCourseId, prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Estudiantes" }

export default function StudentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Hydrate
        prefetch={async (qc) => {
          const id = await activeCourseId(qc)
          if (id) await prefetch(qc, qk.students(id, undefined), apiPath.students(id))
        }}
      >
        <StudentsView />
      </Hydrate>
    </Suspense>
  )
}
