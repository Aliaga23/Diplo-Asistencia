import { AppShell } from "@/components/shell/app-shell"

export default function ConsolaLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
