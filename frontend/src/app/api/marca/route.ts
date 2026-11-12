import { NextResponse, connection } from "next/server"

/** Marca del tenant: la institución dueña de esta instalación (vacía en la instalación del grupo). */
export async function GET() {
  await connection()
  return NextResponse.json(
    {
      institucion: process.env.INSTITUCION?.trim() || null,
      sigla: process.env.INSTITUCION_SIGLA?.trim() || null,
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  )
}
