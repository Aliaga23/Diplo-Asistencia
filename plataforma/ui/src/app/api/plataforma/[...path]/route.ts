import { NextResponse, type NextRequest } from "next/server"

import { API_URL, TOKEN_COOKIE } from "@/lib/sesion"

async function reenviar(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  if (!token) return NextResponse.json({ detail: "Inicia sesión" }, { status: 401 })

  const destino = new URL(`${API_URL}/${path.map(encodeURIComponent).join("/")}`)
  destino.search = request.nextUrl.search

  const headers = new Headers({ Authorization: `Bearer ${token}` })
  const tipo = request.headers.get("content-type")
  if (tipo) headers.set("Content-Type", tipo)

  let respuesta: Response
  try {
    respuesta = await fetch(destino, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ detail: "La API de la plataforma no está disponible" }, { status: 503 })
  }
  return new NextResponse(respuesta.status === 204 ? null : respuesta.body, {
    status: respuesta.status,
    headers: { "content-type": respuesta.headers.get("content-type") ?? "application/json" },
  })
}

export { reenviar as GET, reenviar as POST, reenviar as PATCH, reenviar as DELETE }
