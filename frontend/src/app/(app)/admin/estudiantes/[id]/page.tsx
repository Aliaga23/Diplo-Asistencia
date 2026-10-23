import type { Metadata } from "next"
import { Suspense } from "react"

import { StudentDetail } from "@/app/(app)/admin/estudiantes/[id]/student-detail"
import { Hydrate } from "@/components/common/hydrate"
import { PageSkeleton } from "@/components/common/page-skeleton"
import { apiPath, qk } from "@/lib/query-keys"
import { activeCourseId, prefetch } from "@/lib/server-api"

export const metadata: Metadata = { title: "Estudiante" }

export default function StudentDetailPage({ params }: PageProps<"/admin/estudiantes/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <Hydrate
          prefetch={async (qc) => {
            const courseId = await activeCourseId(qc)
            if (!courseId) return
            await Promise.all([
              prefetch(qc, qk.student(id, courseId), apiPath.student(id, courseId)),
              prefetch(qc, qk.studentAttendance(id, courseId), apiPath.studentAttendance(id, courseId)),
            ])
          }}
        >
          <StudentDetail />
        </Hydrate>
      ))}
    </Suspense>
  )
}
