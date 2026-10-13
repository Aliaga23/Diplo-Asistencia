"use client"

import {
  CaretUpDownIcon,
  CheckIcon,
  GearSixIcon,
  GraduationCapIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { Logo } from "@/components/brand/logo"
import { useCourse } from "@/components/app-shell/course-context"
import type { NavItem } from "@/components/app-shell/nav"
import { UserMenu } from "@/components/app-shell/user-menu"
import { ProgramModal } from "@/components/programs/program-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

function CourseSwitcher() {
  const router = useRouter()
  const { course, courses, setCourseId, isLoading } = useCourse()
  const [creating, setCreating] = useState(false)
  if (isLoading) return <Skeleton className="h-12 w-full bg-sidebar-accent" />
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="border border-sidebar-border">
                <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-primary">
                  <GraduationCapIcon weight="duotone" className="size-[18px]" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[11px] text-sidebar-foreground/55">Programa activo</span>
                  <span className="truncate text-sm font-medium">{course?.name ?? "Sin programas"}</span>
                </div>
                <CaretUpDownIcon className="ml-auto size-4 opacity-60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Programas</DropdownMenuLabel>
              {courses.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => setCourseId(c.id)} className="py-2">
                  <div className="grid flex-1">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {c.code} · {c.students_count} estudiantes
                    </span>
                  </div>
                  {c.id === course?.id && <CheckIcon className="text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                <PlusIcon />
                Nuevo programa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/admin/programas")}>
                <GearSixIcon />
                Administrar programas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <ProgramModal open={creating} onOpenChange={setCreating} onSaved={(c) => setCourseId(c.id)} />
    </>
  )
}

export function AppSidebar({
  nav,
  showCourse = false,
}: {
  nav: { label: string; items: NavItem[] }[]
  showCourse?: boolean
}) {
  const pathname = usePathname()
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Link href="/" className="px-1 text-sidebar-accent-foreground group-data-[collapsible=icon]:px-0">
          <Logo className="group-data-[collapsible=icon]:[&>div]:hidden" />
        </Link>
        {showCourse && (
          <div className="group-data-[collapsible=icon]:hidden">
            <CourseSwitcher />
          </div>
        )}
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        {nav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] tracking-wider text-sidebar-foreground/45 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isActive(item)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="relative h-9 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:-left-2 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary"
                    >
                      <Link href={item.href}>
                        <item.icon
                          weight={active ? "fill" : "regular"}
                          className={active ? "text-sidebar-primary" : ""}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="pb-3">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
