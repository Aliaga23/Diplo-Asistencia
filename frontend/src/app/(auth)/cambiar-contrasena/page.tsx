import type { Metadata } from "next"
import { Suspense } from "react"

import { ChangePasswordForm } from "@/app/(auth)/cambiar-contrasena/change-password-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = { title: "Cambiar contraseña" }

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-32 h-[460px] w-full max-w-md rounded-xl" />}>
      <ChangePasswordForm />
    </Suspense>
  )
}
