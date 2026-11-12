export const TOKEN_COOKIE = "plataforma_token"

export const API_URL = process.env.API_URL ?? "http://localhost:8010"

export function tokenVigente(token: string | undefined): boolean {
  if (!token) return false
  try {
    const payload = token.split(".")[1]
    const datos = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    return !!datos.exp && datos.exp * 1000 > Date.now()
  } catch {
    return false
  }
}
