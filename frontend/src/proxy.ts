import { NextResponse, type NextRequest } from "next/server"

import { MUST_CHANGE_COOKIE, TOKEN_COOKIE, homeFor, readClaims } from "@/lib/session"

/**
 * Redirecciones optimistas por rol. La autorización definitiva la aplica el backend
 * en cada endpoint; aquí solo evitamos mostrar pantallas que no corresponden.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const claims = readClaims(request.cookies.get(TOKEN_COOKIE)?.value)
  const mustChange = request.cookies.has(MUST_CHANGE_COOKIE)

  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url))

  if (pathname === "/") return redirect(claims ? homeFor(claims.role) : "/login")

  if (pathname === "/login") {
    return claims && !mustChange ? redirect(homeFor(claims.role)) : NextResponse.next()
  }

  if (!claims) {
    const next = encodeURIComponent(pathname + search)
    return redirect(`/login?next=${next}`)
  }

  if (mustChange && pathname !== "/cambiar-contrasena") return redirect("/cambiar-contrasena")

  if (pathname.startsWith("/admin") && claims.role !== "admin") return redirect("/estudiante")
  if (pathname.startsWith("/estudiante") && claims.role !== "student") return redirect("/admin")

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login", "/cambiar-contrasena", "/admin/:path*", "/estudiante/:path*"],
}
