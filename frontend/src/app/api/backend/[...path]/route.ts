import { NextResponse, type NextRequest } from "next/server"

import { API_URL, TOKEN_COOKIE } from "@/lib/session"

/**
 * Backend-for-Frontend: reenvía /api/backend/* a FastAPI (/api/v1/*) adjuntando
 * el JWT de la cookie httpOnly. El navegador nunca ve el token.
 */
async function forward(request: NextRequest, ctx: RouteContext<"/api/backend/[...path]">) {
  const { path } = await ctx.params
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  if (!token) return NextResponse.json({ detail: "No autenticado" }, { status: 401 })

  const target = new URL(`${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}`)
  target.search = request.nextUrl.search

  const headers = new Headers({ Authorization: `Bearer ${token}` })
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)

  const hasBody = !["GET", "HEAD"].includes(request.method)
  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    })
  } catch {
    return NextResponse.json(
      { detail: "El servidor de la API no está disponible" },
      { status: 503 }
    )
  }

  const out = new Headers()
  for (const h of ["content-type", "content-disposition"]) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }
  return new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  })
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE }
