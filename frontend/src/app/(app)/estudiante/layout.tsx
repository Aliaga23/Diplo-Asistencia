import { Suspense } from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { ShellSkeleton } from "@/components/app-shell/shell-skeleton"

export default function StudentLayout({ children }: LayoutProps<"/estudiante">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell role="student">{children}</AppShell>
    </Suspense>
  )
}
