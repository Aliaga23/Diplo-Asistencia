import { NextResponse, type NextRequest } from "next/server"

import { API_URL, MUST_CHANGE_COOKIE, TOKEN_COOKIE, readClaims } from "@/lib/session"
import type { User } from "@/lib/types"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.registration_code || !body?.password) {
    return NextResponse.json(
      { detail: "Ingresa tu número de registro y contraseña" },
      { status: 400 }
    )
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_code: String(body.registration_code).trim(),
        password: body.password,
      }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json(
      { detail: "No se pudo conectar con el servidor. Intenta nuevamente." },
      { status: 503 }
    )
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json(data, { status: res.status })

  const { access_token, user } = data as { access_token: string; user: User }
  const claims = readClaims(access_token)
  // Detrás de Traefik la petición llega por HTTP interno: el protocolo real viene en X-Forwarded-Proto.
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:"
  const maxAge = claims ? Math.max(claims.exp - Math.floor(Date.now() / 1000), 60) : 3600

  const response = NextResponse.json({ user })
  response.cookies.set(TOKEN_COOKIE, access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  })
  if (user.must_change_password) {
    response.cookies.set(MUST_CHANGE_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge,
    })
  } else {
    response.cookies.delete(MUST_CHANGE_COOKIE)
  }
  return response
}
