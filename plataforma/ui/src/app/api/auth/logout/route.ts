import { NextResponse } from "next/server"

import { TOKEN_COOKIE } from "@/lib/sesion"

export async function POST() {
  const salida = NextResponse.json({ ok: true })
  salida.cookies.delete(TOKEN_COOKIE)
  return salida
}
