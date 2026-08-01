import type { Metadata } from "next"
import { cookies } from "next/headers"
import { requireAdminPage } from "@/lib/admin/auth"
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
 * rather than assuming the layout vouched for it. Both go through the same
 * helper so the two layers cannot drift apart.
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

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdminPage()

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
