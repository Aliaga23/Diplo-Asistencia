import type { Metadata } from "next"
import { Suspense } from "react"

import { StudentDetail } from "@/app/(app)/admin/estudiantes/[id]/student-detail"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Estudiante" }

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <StudentDetail />
    </Suspense>
  )
}
