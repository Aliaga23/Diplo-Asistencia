"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { Pagina } from "@/components/plataforma/pagina"
import { DESTACADO, PlanTarjeta } from "@/components/plataforma/plan-tarjeta"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { Plan } from "@/lib/tipos"

export default function Planes() {
  const { data: planes } = useQuery({ queryKey: ["planes"], queryFn: () => api<Plan[]>("/planes") })
  return (
    <Pagina
      eyebrow="Tenants"
      titulo="Catálogo de planes"
      descripcion="Cada plan define la capacidad de cómputo, el almacenamiento y la base de datos de un tenant. Terraform y Pulumi leen el mismo catálogo."
    >
      <div className="grid items-stretch gap-6 pt-3 md:grid-cols-3">
        {planes
          ? planes.map((p) => (
              <PlanTarjeta
                key={p.id}
                plan={p}
                accion={
                  <Button asChild variant={p.id === DESTACADO ? "default" : "outline"} className="h-10 w-full">
                    <Link href={`/tenants/nuevo?plan=${p.id}`}>Crear tenant {p.nombre}</Link>
                  </Button>
                }
              />
            ))
          : [0, 1, 2].map((i) => <Skeleton key={i} className="h-[520px] rounded-2xl" />)}
      </div>
    </Pagina>
  )
}
