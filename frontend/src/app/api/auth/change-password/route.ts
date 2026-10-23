import { NextResponse, type NextRequest } from "next/server"

import { API_URL, MUST_CHANGE_COOKIE, TOKEN_COOKIE } from "@/lib/session"

export async function POST(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  if (!token) return NextResponse.json({ detail: "No autenticado" }, { status: 401 })

  const res = await fetch(`${API_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: await request.text(),
    cache: "no-store",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "No se pudo cambiar la contraseña" }))
    return NextResponse.json(data, { status: res.status })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(MUST_CHANGE_COOKIE)
  return response
}
