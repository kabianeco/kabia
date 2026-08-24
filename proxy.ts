import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { classifyAuthError, isPublicAdminPath } from "@/lib/admin/access"

/**
 * The single Next.js proxy (formerly "middleware" — Next 16 renamed the file
 * convention from middleware.{ts,js} to proxy.{ts,js} and deprecated the old
 * name; the exported function and its behaviour are unchanged).
 *
 * Three responsibilities:
 *
 *   1. Development canonical-origin redirect — see maybeCanonicalDevOrigin.
 *   2. Admin session synchronisation — scoped to /admin only.
 *   3. SEC-09: Per-request nonce generation + security headers (CSP, HSTS,
 *      X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
 */

// ---------------------------------------------------------------------------
// SEC-09: Security headers and per-request nonce
// ---------------------------------------------------------------------------

/** Generates a cryptographically random nonce for CSP. Edge uyumlu: Node crypto yerine Web Crypto kullanır. */
function generateNonce(): string {
  // Edge runtime'da Node 'crypto' modülü yoktur, Web Crypto (globalThis.crypto) her yerde vardır.
  // 16 byte = 128 bit nonce, base64 olarak CSP 'nonce-...' ile uyumlu.
  const bytes = new Uint8Array(16)
  // globalThis.crypto Edge ve Node 18+ üzerinde mevcut
  globalThis.crypto.getRandomValues(bytes)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Derives the Supabase auth origin for OAuth redirect and CSP connect-src. */
function supabaseAuthOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Builds the Content-Security-Policy header value for a given nonce.
 *
 * Production:
 *   - script-src uses 'nonce-{random}' + 'strict-dynamic' (no 'unsafe-inline',
 *     no 'unsafe-eval')
 *   - style-src allows 'unsafe-inline' because the theme engine produces
 *     inline CSS variables from a closed, enumerated vocabulary (no
 *     attacker-controlled CSS string can enter the inline style block)
 *   - img-src allows Next.js image optimization + Supabase Storage + picsum
 *   - connect-src allows Supabase Auth/REST/Realtime only
 *
 * Development adds ws: and localhost origins for HMR without leaking into
 * production.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const sbOrigin = supabaseAuthOrigin()

  const scriptSrc = [
    `'self'`,
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    isDev ? "'unsafe-eval'" : "", // Next.js dev Fast Refresh
  ].filter(Boolean).join(" ")

  const styleSrc = [
    "'self'",
    "'unsafe-inline'", // theme engine CSS variables from closed vocabulary
  ].join(" ")

  const imgSrc = [
    "'self'",
    "data:", // next/image uses data: for placeholder during optimization
    "https:",
    "blob:", // next/image sometimes uses blob: during optimization
  ].filter(Boolean).join(" ")

  const connectSrc = [
    "'self'",
    sbOrigin ?? "https://*.supabase.co",
    isDev ? "ws://localhost:3000 ws://127.0.0.1:3000" : "",
  ].filter(Boolean).join(" ")

  const fontSrc = [
    "'self'",
    "data:", // next/font inlines font data
  ].join(" ")

  const frameSrc = ["'self'"].join(" ")
  const workerSrc = ["'self'", "blob:"].join(" ")
  const manifestSrc = ["'self'"].join(" ")

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    `worker-src ${workerSrc}`,
    `manifest-src ${manifestSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ]

  return directives.join("; ")
}

/** Applies security headers to any response. */
function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
  isDev: boolean,
): void {
  response.headers.set("Content-Security-Policy", buildCsp(nonce, isDev))
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  )

  // HSTS only in production and only when HTTPS is guaranteed.
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    )
  }

  // Store the nonce in a custom request header so server components can
  // read it via headers() and apply it to inline scripts.
  response.headers.set("x-nonce", nonce)
}

// ---------------------------------------------------------------------------
// Development canonical-origin redirect
// ---------------------------------------------------------------------------

/** The host `npm run dev` binds to; the HMR client expects this origin. */
const CANONICAL_DEV_HOST = "localhost"

/**
 * True when the request is a browser navigation that may be canonicalised —
 * a top-level HTML document request, not an RSC/Flight fetch, not a WebSocket
 * upgrade, not a static asset, and not a server action.
 */
function isBrowserDocumentRequest(request: NextRequest): boolean {
  if (request.method !== "GET") return false
  if (request.headers.get("upgrade")) return false // WebSocket (HMR)
  if (request.headers.get("rsc")) return false // RSC / Flight fetch
  if (request.headers.get("next-action")) return false // server action
  const accept = request.headers.get("accept") ?? ""
  if (!accept.includes("text/html")) return false
  const { pathname } = request.nextUrl
  if (pathname.startsWith("/_next/")) return false
  if (pathname.startsWith("/favicon")) return false
  return true
}

/**
 * In development, redirect 127.0.0.1 document requests to localhost once,
 * preserving pathname and query. Returns the redirect, or null to pass through.
 */
function maybeCanonicalDevOrigin(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "development") return null
  if (!isBrowserDocumentRequest(request)) return null

  const host = request.headers.get("host")
  if (!host) return null
  const hostname = host.split(":")[0]
  // Only the IPv4 loopback is canonicalised. LAN addresses and ::1 are left
  // alone; this project does not configure Next's allowedDevOrigins for them.
  if (hostname !== "127.0.0.1") return null

  const url = request.nextUrl
  const canonical = new URL(url.pathname + url.search, request.url)
  canonical.hostname = CANONICAL_DEV_HOST
  canonical.port = url.port
  canonical.protocol = url.protocol
  return NextResponse.redirect(canonical, 307)
}

// ---------------------------------------------------------------------------
// Admin session synchronisation (formerly proxy.ts)
// ---------------------------------------------------------------------------

async function adminSessionSync(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // The guard header marks every admin response — redirects included — so
  // route protection stays verifiable from outside the app.
  const guard = (response: NextResponse): NextResponse => {
    response.headers.set("x-kabia-admin-guard", "1")
    return response
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return guard(NextResponse.next({ request }))

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Write refreshed tokens onto the request first, so server components
        // below read the same session this layer just saw. This is a
        // request-local synchronization: no `Set-Cookie` is emitted from this
        // call. The browser-visible response boundary is the
        // `response.cookies.set(name, value, options)` call below, which
        // forwards the SameSite/Secure/HttpOnly/Path/Expiry attributes from
        // @supabase/ssr's `cookieOptions` (defaults: sameSite=Lax, secure in
        // production, httpOnly=true, path=/). The Semgrep
        // `cookies-default-koa` rule fires on this line because it sees the
        // bare two-arg form; that is by design here because request-local
        // cookies do not produce a `Set-Cookie` response header, so response
        // options on the request-cookie container would be a no-op. Suppressed
        // narrowly at this exact statement only — the rule is NOT disabled
        // globally.
        cookiesToSet.forEach(({ name, value }) =>
          // nosemgrep: javascript.koa.web.cookies-default-koa.cookies-default-koa -- request-local synchronization, browser-visible Set-Cookie emitted with options at response.cookies.set() below
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        // …and onto the outgoing response, or the session silently expires.
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // A bare redirect would drop every cookie the session check just wrote.
  const redirectWithSession = (target: URL): NextResponse => {
    const redirectResponse = NextResponse.redirect(target)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return guard(redirectResponse)
  }

  // "Supabase could not be reached" is not "this visitor is anonymous".
  const determined = !error || classifyAuthError(error) === "unauthenticated"

  if (!user && determined && !isPublicAdminPath(pathname)) {
    const loginUrl = new URL("/admin/login", request.url)
    if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname)
    return redirectWithSession(loginUrl)
  }

  return guard(response)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development"
  const nonce = generateNonce()

  // Helper to apply security headers to any response we produce.
  const withHeaders = (resp: NextResponse): NextResponse => {
    applySecurityHeaders(resp, nonce, isDev)
    return resp
  }

  // Pass the nonce to server components via the request headers.
  request.headers.set("x-nonce", nonce)

  // 1. Development canonical-origin redirect — must run first so the HMR
  //    client initialises on the canonical origin.
  const canonical = maybeCanonicalDevOrigin(request)
  if (canonical) return withHeaders(canonical)

  // 2. Admin session synchronisation (/admin only).
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const adminResp = await adminSessionSync(request)
    return withHeaders(adminResp)
  }

  return withHeaders(NextResponse.next({ request }))
}

/**
 * Runs on everything except static assets, the image optimizer, and the HMR
 * WebSocket endpoint. The canonical-origin redirect needs document requests on
 * every route; the admin session sync only acts on /admin.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico).*)",
  ],
}