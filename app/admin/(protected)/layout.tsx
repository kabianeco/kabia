import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { resolveAdminAccess } from "@/lib/admin/auth"
import { guardOutcome } from "@/lib/admin/access"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdminShell, type ShellAlerts } from "@/components/admin/admin-shell"
import { adminSignOutAction } from "../login/actions"

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s | Kabia Yönetim" },
  robots: { index: false, follow: false },
}

/**
 * Layer 2 of admin route protection: the role check.
 *
 * Runs on the server for every *document* request in the group.
 * `requireAdminPage()` validates the session against the Auth server and
 * re-reads the role from `user_roles` on each request, so revoking an
 * administrator takes effect on their very next navigation rather than whenever
 * their JWT happens to expire.
 *
 * This layer is not sufficient on its own. On a soft navigation between two
 * routes in this group, Next.js reuses the already-rendered layout from the
 * client router cache and this function does not run at all — which is why
 * every page below also calls `requireAdminPage()` / `adminPageContext()`
 * rather than assuming the layout vouched for it. Both resolve the same
 * request-scoped verdict, so the two layers cannot drift apart, and within one
 * request the extra calls cost nothing.
 *
 * When authorization cannot be determined at all — Supabase unreachable, the
 * `user_roles` read failing — `requireAdminPage()` throws instead of
 * redirecting, and `app/admin/error.tsx` renders a stable error. A layout must
 * never answer "I could not check" with "you are signed out": the proxy above
 * would disagree on the next request and the browser would shuttle between
 * them.
 *
 * Nothing is cached: administrative data is private and must never end up in a
 * shared cache.
 */
export const dynamic = "force-dynamic"
export const revalidate = 0

async function loadAlerts(): Promise<ShellAlerts> {
  const empty: ShellAlerts = { outOfStock: 0, lowStock: 0, preparingOrders: 0 }
  try {
    const supabase = await createSupabaseServerClient()
    const [risk, preparing] = await Promise.all([
      supabase.rpc("admin_inventory_risk"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "hazirlaniyor"),
    ])

    const riskData = (risk.data ?? {}) as { out_of_stock?: number; low?: number }
    return {
      outOfStock: Number(riskData.out_of_stock ?? 0),
      lowStock: Number(riskData.low ?? 0),
      preparingOrders: preparing.count ?? 0,
    }
  } catch {
    // The shell must render even if the alert queries fail; the pages below
    // surface their own error states.
    return empty
  }
}

/**
 * Shown when Supabase could not tell us who the caller is.
 *
 * Deliberately inert: no redirect, no `router.refresh()`, no timer, no poll.
 * The operator's session is untouched, so the only correct move is to say so
 * and let them retry when they choose. Every automatic recovery attempt that
 * used to live at this point in the code became a loop.
 */
function AdminUnavailable() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="label text-olive">Bağlantı sorunu</p>
        <h1 className="mt-4 font-serif text-3xl leading-tight text-ink">
          Yetkiniz şu anda doğrulanamıyor
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-ink/60">
          Oturumunuz kapatılmadı. Sunucuya geçici olarak ulaşılamadığı için panel
          görüntülenemedi. Sayfayı yenileyerek tekrar deneyebilirsiniz.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/admin"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Tekrar dene
          </Link>
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-6 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
          >
            Mağazaya dön
          </Link>
        </div>
      </div>
    </main>
  )
}

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const outcome = guardOutcome(await resolveAdminAccess())

  // Handled here rather than by throwing into an error boundary: `error.tsx`
  // does not catch an error raised by a layout in its own segment, so throwing
  // would land on Next's bare error shell. Rendering the state directly keeps
  // it stable and identical in development and production — and, critically,
  // keeps it a *render*. The one thing this branch must never do is navigate.
  if (outcome.kind === "unavailable") return <AdminUnavailable />

  if (outcome.kind === "redirect") redirect(outcome.to)

  const session = outcome.session
  const [alerts, cookieStore] = await Promise.all([loadAlerts(), cookies()])
  const collapsed = cookieStore.get("kabia_admin_sidebar")?.value === "1"

  return (
    <AdminShell
      session={{
        displayName: session.displayName,
        email: session.email,
        role: session.role,
      }}
      defaultCollapsed={collapsed}
      alerts={alerts}
      signOutAction={adminSignOutAction}
    >
      {children}
    </AdminShell>
  )
}
