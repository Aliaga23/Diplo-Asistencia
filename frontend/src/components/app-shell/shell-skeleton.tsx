import { Skeleton } from "@/components/ui/skeleton"

/** Esqueleto del shell mientras se resuelve la sesión y los datos en el cliente. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-64 shrink-0 bg-sidebar md:block" />
      <div className="flex-1">
        <div className="h-14 border-b" />
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-8 md:px-8">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
