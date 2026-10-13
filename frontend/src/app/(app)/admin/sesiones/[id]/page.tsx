import type { Metadata } from "next"
import { Suspense } from "react"

import { SessionDetail } from "@/app/(app)/admin/sesiones/[id]/session-detail"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Control de asistencia" }

export default function SessionDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SessionDetail />
    </Suspense>
  )
}
