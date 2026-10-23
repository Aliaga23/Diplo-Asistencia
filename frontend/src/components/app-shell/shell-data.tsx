import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { AppShell } from "@/components/app-shell/app-shell"
import { apiPath, qk } from "@/lib/query-keys"
import { activeCourseId, createServerQueryClient, prefetch } from "@/lib/server-api"

/** Server Component: precarga el usuario y los programas antes de pintar el shell. */
export async function ShellData({
  role,
  children,
}: {
  role: "admin" | "student"
  children: React.ReactNode
}) {
  const qc = createServerQueryClient()
  const [courseId] = await Promise.all([activeCourseId(qc), prefetch(qc, qk.me, apiPath.me)])
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <AppShell role={role} initialCourseId={courseId}>
        {children}
      </AppShell>
    </HydrationBoundary>
  )
}
