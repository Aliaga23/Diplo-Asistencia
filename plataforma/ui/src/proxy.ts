import { NextResponse, type NextRequest } from "next/server"

import { TOKEN_COOKIE, tokenVigente } from "@/lib/sesion"

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const vigente = tokenVigente(request.cookies.get(TOKEN_COOKIE)?.value)
  const ir = (destino: string) => NextResponse.redirect(new URL(destino, request.url))

  if (pathname === "/login") return vigente ? ir("/panel") : NextResponse.next()
  if (!vigente) return ir(`/login?next=${encodeURIComponent(pathname + search)}`)
  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/panel", "/tenants/:path*", "/planes", "/eventos"],
}
