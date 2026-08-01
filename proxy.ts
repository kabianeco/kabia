import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Layer 1 of admin route protection: the session check.
 *
 * Scoped by `config.matcher` to /admin only — the public storefront never runs
 * through here, so nothing about the store's behaviour or caching changes.
 *
 * This layer answers exactly one question: is there a session at all? It
 * deliberately does not look at roles. Role checks belong in the protected
 * layout and in every server action, where a fresh database read decides, and
 * ultimately in RLS. Treating an edge check as authorization would mean
 * trusting a token that could have been revoked a second ago.
 *
 * The response header exists so route protection can be verified from outside
 * the app rather than inferred.
 */

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/unauthorized"]

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The guard header marks every admin response — redirects included — so
  // route protection stays verifiable from outside the app. Applied at the
  // return points because `setAll` below may replace the response object.
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
        // Write the refreshed tokens back onto the *request* first, so the
        // server components rendered below this layer read the same session
        // the proxy just saw. Without this, the layout keeps the expired
        // cookie and burns the just-rotated refresh token a second time —
        // which either double-refreshes within the reuse window (rotating the
        // token again, unpersisted) or fails outright and redirects to the
        // login page while this layer insists the user is signed in. That
        // disagreement is a redirect loop.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        // …and onto the outgoing response, or the session silently expires
        // mid-visit.
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A bare NextResponse.redirect would drop every cookie the session check
  // just wrote — a rotated token, or the clearing of a dead session — leaving
  // the browser to act on its stale session again on the very next request.
  const redirectWithSession = (target: URL): NextResponse => {
    const redirectResponse = NextResponse.redirect(target)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return guard(redirectResponse)
  }

  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )

  if (!user && !isPublicAdminPath) {
    const loginUrl = new URL("/admin/login", request.url)
    // Come back to whatever was being asked for after signing in.
    if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname)
    return redirectWithSession(loginUrl)
  }

  // An administrator who is already signed in has no use for the login screen.
  if (user && pathname === "/admin/login") {
    return redirectWithSession(new URL("/admin", request.url))
  }

  return guard(response)
}

export const config = {
  matcher: ["/admin/:path*"],
}
