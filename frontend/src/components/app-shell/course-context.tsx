"use client"

import { createContext, useContext, useMemo, useState } from "react"

import { useCourses } from "@/lib/queries"
import type { Course } from "@/lib/types"

const STORAGE_KEY = "presencia.course"

interface CourseCtx {
  course: Course | undefined
  courses: Course[]
  setCourseId: (id: string) => void
  isLoading: boolean
}

const Ctx = createContext<CourseCtx | null>(null)

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { data: courses = [], isLoading } = useCourses()
  // Lectura perezosa: los cursos llegan por React Query (no en SSR), así que no hay desajuste de hidratación.
  const [courseId, setCourseIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const setCourseId = (id: string) => {
    setCourseIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* almacenamiento no disponible */
    }
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
