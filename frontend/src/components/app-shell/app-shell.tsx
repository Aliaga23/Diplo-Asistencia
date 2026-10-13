"use client"

import { AppHeader } from "@/components/app-shell/app-header"
import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { CourseProvider } from "@/components/app-shell/course-context"
import { ADMIN_NAV, STUDENT_NAV } from "@/components/app-shell/nav"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({
  role,
  children,
}: {
  role: "admin" | "student"
  children: React.ReactNode
}) {
  const nav = role === "admin" ? ADMIN_NAV : STUDENT_NAV
  return (
    <CourseProvider>
      <SidebarProvider>
        <AppSidebar nav={nav} showCourse={role === "admin"} />
        <SidebarInset className="bg-background">
          <AppHeader nav={nav} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </CourseProvider>
  )
}
