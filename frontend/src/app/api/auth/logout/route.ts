import { NextResponse } from "next/server"

import { MUST_CHANGE_COOKIE, TOKEN_COOKIE } from "@/lib/session"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(TOKEN_COOKIE)
  response.cookies.delete(MUST_CHANGE_COOKIE)
  return response
}
