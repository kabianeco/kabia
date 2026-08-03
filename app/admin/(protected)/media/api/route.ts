import { NextResponse, type NextRequest } from "next/server"
import { adminContext } from "@/lib/admin/auth"
import { AdminAuthError, AdminAuthUnavailableError } from "@/lib/admin/errors"
import { loadMediaPage, type MediaSort } from "@/lib/admin/queries/media"
import { MEDIA_MIME_LABELS, MEDIA_PAGE_SIZE } from "@/lib/admin/media"

/**
 * The media catalogue, for the product picker.
 *
 * The picker is a client component inside a form, so it cannot call a server
 * component and must not be handed the whole library up front. This endpoint
 * gives it one page at a time.
 *
 * It re-authorises on its own rather than assuming the layout above it did:
 * a route handler is directly addressable, so anyone can request this URL with
 * whatever cookie they like. `adminContext("manageMedia")` re-reads the role
 * from `user_roles`, which means an administrator downgraded a second ago gets
 * 403 here even though their session is still valid — and the query below runs
 * through their own client, so RLS would return nothing even if that check were
 * somehow bypassed.
 *
 * Never cached: this is private, per-user, role-dependent data.
 */
export const dynamic = "force-dynamic"

const SORTS: readonly MediaSort[] = ["newest", "oldest", "name", "largest"]

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await adminContext("manageMedia")

    const params = request.nextUrl.searchParams
    const rawPage = Number(params.get("page"))
    const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1

    const rawSort = params.get("sirala")
    const sort = SORTS.includes(rawSort as MediaSort) ? (rawSort as MediaSort) : "newest"

    const rawMime = params.get("tur")
    const mimeType = rawMime && MEDIA_MIME_LABELS[rawMime] ? rawMime : undefined

    const search = params.get("q")?.slice(0, 80) || undefined

    const result = await loadMediaPage(supabase, {
      search,
      mimeType,
      sort,
      page,
      pageSize: MEDIA_PAGE_SIZE,
    })

    return NextResponse.json(
      { assets: result.assets, total: result.total, page: result.page },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (error) {
    // Indeterminate authorization is a 503, not a 401. A 401 would tell the
    // client it has been signed out and invite it to navigate to the login
    // page; the session is in fact untouched and the caller should retry.
    if (error instanceof AdminAuthUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { "cache-control": "no-store" } },
      )
    }
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.kind === "unauthenticated" ? 401 : 403, headers: { "cache-control": "no-store" } },
      )
    }
    console.error("[admin] media:api:", error)
    return NextResponse.json({ error: "İstek tamamlanamadı." }, { status: 500 })
  }
}
