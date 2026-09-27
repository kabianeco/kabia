/**
 * Proxy refresh guards (database-free, unit-tested).
 *
 * Supabase Auth /token is per-IP limited (150/5min, burst 30). Server-side
 * calls share Vercel's egress IPs, so every unnecessary refresh spends the
 * shared bucket. The admin sync in proxy.ts must skip:
 *  - prefetch / RSC prefetch requests (Next-Router-Prefetch, Sec-Purpose),
 *    which fire on hover/link render for navigations that may never happen;
 *  - static assets that slipped past the matcher;
 *  - anonymous requests with no session cookies (nothing to refresh);
 *  - sessions whose access token is not near expiry (no refresh needed).
 *
 * All helpers are pure for database-free tests; proxy.ts wires them to
 * NextRequest.
 */

/** True for Next.js prefetch / RSC prefetch requests. */
export function isPrefetchRequest(headers: Headers): boolean {
  if ((headers.get("Next-Router-Prefetch") ?? "").trim() === "1") return true
  const purpose = (headers.get("Purpose") ?? headers.get("Sec-Purpose") ?? "").toLowerCase()
  if (purpose.includes("prefetch")) return true
  // RSC prefetch without the explicit flag still carries no document accept.
  // Callers combine this with method/static checks; alone it is not enough.
  return false
}

/** True for paths that must never trigger an Auth refresh. */
export function isStaticAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true
  if (pathname.startsWith("/images/") || pathname.startsWith("/icons/")) return true
  if (pathname === "/favicon.ico" || pathname === "/icon.svg" || pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/manifest.webmanifest") return true
  // Any other file-like path (…​.png, …​.css, …​.map) is static.
  const last = pathname.split("/").pop() ?? ""
  if (last.includes(".") && /\.[a-z0-9]{2,5}$/i.test(last)) return true
  return false
}

/** True when at least one Supabase auth-token cookie is present. */
export function hasSessionCookies(cookies: Array<{ name: string }>): boolean {
  return cookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
}

function decodeJwtExp(accessToken: string): number | null {
  try {
    const parts = accessToken.split(".")
    if (parts.length < 2 || !parts[1]) return null
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8") as string) as { exp?: unknown }
    return typeof json.exp === "number" ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Milliseconds until the access token expires, or null when it cannot be
 * determined (missing/unparsable cookie — the caller must refresh to find out).
 */
export function sessionExpiryMs(authTokenCookieValue: string | undefined, nowMs = Date.now()): number | null {
  if (!authTokenCookieValue) return null
  try {
    const decoded = decodeURIComponent(authTokenCookieValue)
    const parsed: unknown = JSON.parse(decoded)
    const first = Array.isArray(parsed) ? parsed[0] : parsed
    if (first && typeof first === "object") {
      const rec = first as Record<string, unknown>
      if (typeof rec.expires_at === "number") return rec.expires_at * 1000 - nowMs
      if (typeof rec.expires_at === "string") {
        const n = Number(rec.expires_at)
        if (Number.isFinite(n)) return n * 1000 - nowMs
      }
      if (typeof rec.access_token === "string") {
        const exp = decodeJwtExp(rec.access_token)
        if (exp !== null) return exp - nowMs
      }
    }
  } catch {
    // Fall through to raw JWT attempt below.
  }
  const trimmed = authTokenCookieValue.trim()
  if (trimmed.startsWith("eyJ")) {
    const exp = decodeJwtExp(trimmed)
    if (exp !== null) return exp - nowMs
  }
  return null
}

/** Refresh is needed only when expiry is unknown or within the window. */
export function isTokenNearExpiry(authTokenCookieValue: string | undefined, nowMs = Date.now(), windowMs = 60_000): boolean {
  const remaining = sessionExpiryMs(authTokenCookieValue, nowMs)
  if (remaining === null) return true
  return remaining <= windowMs
}

/**
 * Single decision for the admin sync: skip the Supabase getUser/refresh when
 * any guard fires. Server actions and document navigations with a live
 * session still refresh; everything else stays off /token.
 */
export function shouldSkipAdminRefresh(input: {
  headers: Headers
  pathname: string
  cookies: Array<{ name: string; value?: string }>
  nowMs?: number
}): boolean {
  if (input.headers.get("next-action")) return true
  if (isPrefetchRequest(input.headers)) return true
  if (isStaticAssetPath(input.pathname)) return true
  if (!hasSessionCookies(input.cookies)) return true
  const tokenCookie = input.cookies.find((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && !c.name.includes("code-verifier"))
  if (tokenCookie?.value && !isTokenNearExpiry(tokenCookie.value, input.nowMs ?? Date.now())) return true
  return false
}
