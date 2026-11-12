import { PageHeader } from "@/components/common/page-header"

export function Pagina({
  titulo,
  descripcion,
  eyebrow,
  acciones,
  children,
}: {
  titulo: React.ReactNode
  descripcion?: React.ReactNode
  eyebrow?: React.ReactNode
  acciones?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <PageHeader title={titulo} description={descripcion} eyebrow={eyebrow} actions={acciones} />
      <div className="space-y-6">{children}</div>
    </>
  )
}
