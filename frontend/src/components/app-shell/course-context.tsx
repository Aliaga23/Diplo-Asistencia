"use client"

import { createContext, useContext, useMemo, useState } from "react"

import { useCourses } from "@/lib/queries"
import { COURSE_COOKIE } from "@/lib/session"
import type { Course } from "@/lib/types"

interface CourseCtx {
  course: Course | undefined
  courses: Course[]
  setCourseId: (id: string) => void
  isLoading: boolean
}

const Ctx = createContext<CourseCtx | null>(null)

/**
 * Programa activo. Se guarda en una cookie para que el servidor precargue los datos del
 * mismo programa; el valor inicial llega del servidor y así no hay desajuste al hidratar.
 */
export function CourseProvider({
  initialCourseId,
  children,
}: {
  initialCourseId?: string
  children: React.ReactNode
}) {
  const { data: courses = [], isLoading } = useCourses()
  const [courseId, setCourseIdState] = useState<string | undefined>(initialCourseId)

  const setCourseId = (id: string) => {
    setCourseIdState(id)
    document.cookie = `${COURSE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`
  }

  const value = useMemo<CourseCtx>(() => {
    const course = courses.find((c) => c.id === courseId) ?? courses[0]
    return { course, courses, setCourseId, isLoading }
  }, [courses, courseId, isLoading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCourse() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useCourse debe usarse dentro de CourseProvider")
  return ctx
}
