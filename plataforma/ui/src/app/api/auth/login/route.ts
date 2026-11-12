import { NextResponse, type NextRequest } from "next/server"

import { API_URL, TOKEN_COOKIE } from "@/lib/sesion"

export async function POST(request: NextRequest) {
  const datos = await request.json().catch(() => null)
  if (!datos?.usuario || !datos?.password) {
    return NextResponse.json({ detail: "Ingresa usuario y contraseña" }, { status: 400 })
  }
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: String(datos.usuario).trim(), password: datos.password }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ detail: "La API de la plataforma no está disponible" }, { status: 503 })
  }
  const cuerpo = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) return NextResponse.json(cuerpo, { status: respuesta.status })

  const salida = NextResponse.json({ ok: true })
  salida.cookies.set(TOKEN_COOKIE, cuerpo.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 12 * 3600,
  })
  return salida
}
