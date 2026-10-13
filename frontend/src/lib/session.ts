/** Utilidades de sesión compartidas por el proxy y los route handlers (sin dependencias de React). */

export const TOKEN_COOKIE = "presencia_token"
export const MUST_CHANGE_COOKIE = "presencia_mcp"

export const API_URL = process.env.API_URL ?? "http://localhost:8000"

export interface TokenClaims {
  sub: string
  role: "admin" | "student"
  exp: number
}

/**
 * Lee las claims del JWT SIN verificar la firma. Solo se usa para redirecciones
 * optimistas en el proxy; la autorización real la hace siempre el backend.
 */
export function readClaims(token: string | undefined): TokenClaims | null {
  if (!token) return null
  try {
    const payload = token.split(".")[1]
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    const claims = JSON.parse(json) as TokenClaims
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null
    return claims
  } catch {
    return null
  }
}

export function homeFor(role: TokenClaims["role"]) {
  return role === "admin" ? "/admin" : "/estudiante"
}
