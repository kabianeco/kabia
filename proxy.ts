import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { classifyAuthError, isPublicAdminPath } from "@/lib/admin/access"

/**
 * The single Next.js proxy (formerly "middleware" — Next 16 renamed the file
 * convention from middleware.{ts,js} to proxy.{ts,js} and deprecated the old
 * name; the exported function and its behaviour are unchanged).
 *
 * Two responsibilities, deliberately kept separate so neither can form a cycle
 * with the protected layout or pages below:
 *
 *   1. Development canonical-origin redirect — see maybeCanonicalDevOrigin.
 *   2. Admin session synchronisation — scoped to /admin only.
 */

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
        // below read the same session this layer just saw.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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
  // 1. Development canonical-origin redirect — must run first so the HMR
  //    client initialises on the canonical origin.
  const canonical = maybeCanonicalDevOrigin(request)
  if (canonical) return canonical

  // 2. Admin session synchronisation (/admin only).
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return adminSessionSync(request)
  }

  return NextResponse.next()
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