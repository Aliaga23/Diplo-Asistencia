import { Suspense } from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { ShellSkeleton } from "@/components/app-shell/shell-skeleton"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell role="admin">{children}</AppShell>
    </Suspense>
  )
}
