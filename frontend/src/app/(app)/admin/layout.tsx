import { Suspense } from "react"

import { ShellData } from "@/components/app-shell/shell-data"
import { ShellSkeleton } from "@/components/app-shell/shell-skeleton"

export default function Layout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <ShellData role="admin">{children}</ShellData>
    </Suspense>
  )
}
