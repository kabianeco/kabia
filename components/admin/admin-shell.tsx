"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Package,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  TriangleAlert,
  Users,
  Warehouse,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { currentSectionLabel, isNavItemActive, navForRole, type AdminNavItem, type AdminNavIcon } from "@/lib/admin/nav"
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/roles"

/**
 * The administrative shell.
 *
 * Kabia's own identity and palette, arranged for work rather than for browsing:
 * a quiet paper sidebar, a compact top bar, and as much of the viewport as
 * possible given to the content. Navigation is a list of plain words in the
 * sans, with the active route marked by a forest rule and full-strength ink —
 * no pills, no icon soup.
 *
 * The collapsed state is persisted in a cookie rather than localStorage, so the
 * server renders the correct width on the first paint and the sidebar never
 * snaps after hydration.
 *
 * Every internal link opts out of prefetching: each admin route is
 * `force-dynamic`, so a prefetched payload is stale the moment it arrives and
 * the router re-requests it on every render — a full auth check plus Supabase
 * queries per link, per paint. Clicking fetches the page exactly once.
 */

export interface ShellAlerts {
  outOfStock: number
  lowStock: number
  preparingOrders: number
}

export interface ShellSession {
  displayName: string
  email: string
  role: AdminRole
}

const COLLAPSE_COOKIE = "kabia_admin_sidebar"

const NAV_ICONS: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  products: Package,
  categories: Tags,
  inventory: Warehouse,
  orders: ShoppingCart,
  customers: Users,
  media: ImageIcon,
  content: FileText,
  settings: Settings,
  administrators: ShieldCheck,
  audit: ScrollText,
}

function NavIcon({ icon, className }: { icon: AdminNavIcon; className?: string }) {
  const Icon = NAV_ICONS[icon]
  if (!Icon) return null
  return <Icon className={className} aria-hidden="true" />
}

function persistCollapsed(collapsed: boolean) {
  document.cookie = `${COLLAPSE_COOKIE}=${collapsed ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`
}

export function AdminShell({
  session,
  defaultCollapsed,
  alerts,
  signOutAction,
  children,
}: {
  session: ShellSession
  defaultCollapsed: boolean
  alerts: ShellAlerts
  signOutAction: () => Promise<void>
  children: ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const items = navForRole(session.role)
  const section = currentSectionLabel(pathname)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      persistCollapsed(!prev)
      return !prev
    })
  }, [])

  return (
    <div className="min-h-dvh bg-ivory">
      <DesktopSidebar
        items={items}
        pathname={pathname}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        alerts={alerts}
      />

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-300", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <TopBar
          section={section}
          session={session}
          alerts={alerts}
          items={items}
          pathname={pathname}
          signOutAction={signOutAction}
        />

        <main id="admin-content" className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[80rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/admin"
      prefetch={false}
      aria-label="Kabia yönetim paneli — genel bakış"
      className="flex items-center gap-2.5 overflow-hidden"
    >
      <Image
        src="/images/logo.svg"
        alt=""
        width={177}
        height={60}
        className="h-6 w-auto shrink-0"
        priority
      />
      {!collapsed && (
        <span className="label whitespace-nowrap text-olive">Yönetim</span>
      )}
    </Link>
  )
}

function NavList({
  items,
  pathname,
  collapsed = false,
  onNavigate,
  alerts,
}: {
  items: AdminNavItem[]
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
  alerts: ShellAlerts
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isNavItemActive(item, pathname)
        const badge =
          item.href === "/admin/inventory"
            ? alerts.outOfStock + alerts.lowStock
            : item.href === "/admin/orders"
              ? alerts.preparingOrders
              : 0
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={false}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex min-h-11 items-center gap-3 rounded-[3px] pl-4 pr-3 text-sm transition-colors duration-200",
                active ? "bg-ink/[0.04] text-ink" : "text-ink/60 hover:bg-ink/[0.02] hover:text-ink",
                collapsed && "justify-center px-0",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-colors duration-200",
                  active ? "bg-brand" : "bg-transparent",
                )}
              />
              <NavIcon icon={item.icon} className="h-[1.1rem] w-[1.1rem] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {badge > 0 && !collapsed && (
                <span className="figure ml-auto rounded-full bg-shell/20 px-2 py-0.5 text-xs text-ink/70">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function DesktopSidebar({
  items,
  pathname,
  collapsed,
  onToggle,
  alerts,
}: {
  items: AdminNavItem[]
  pathname: string
  collapsed: boolean
  onToggle: () => void
  alerts: ShellAlerts
}) {
  return (
    <aside
      aria-label="Yönetim menüsü"
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-ink/10 bg-paper/50 transition-[width] duration-300 lg:flex",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-ink/10",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <BrandMark collapsed={collapsed} />
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <NavList items={items} pathname={pathname} collapsed={collapsed} alerts={alerts} />
      </nav>

      <div className={cn("border-t border-ink/10 py-3", collapsed ? "px-2" : "px-3")}>
        <Link
          href="/"
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-[3px] text-sm text-ink/55 transition-colors duration-200 hover:text-ink",
            collapsed ? "justify-center px-0" : "px-4",
          )}
          title="Mağazayı görüntüle"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Mağazayı gör</span>}
          {collapsed && <span className="sr-only">Mağazayı gör</span>}
        </Link>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-[3px] text-sm text-ink/55 transition-colors duration-200 hover:text-ink",
            collapsed ? "justify-center px-0" : "px-4",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
          <span className={collapsed ? "sr-only" : undefined}>
            {collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          </span>
        </button>
      </div>
    </aside>
  )
}

function TopBar({
  section,
  session,
  alerts,
  items,
  pathname,
  signOutAction,
}: {
  section: string
  session: ShellSession
  alerts: ShellAlerts
  items: AdminNavItem[]
  pathname: string
  signOutAction: () => Promise<void>
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const stockAlerts = alerts.outOfStock + alerts.lowStock

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-ivory/95 backdrop-blur-sm">
        <div className="flex h-16 items-center gap-3 px-4 md:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menüyü aç"
            aria-expanded={menuOpen}
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center text-ink lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg leading-none text-ink md:text-xl">
              {section}
            </p>
          </div>

          <GlobalSearch />

          {stockAlerts > 0 && (
            <Link
              href="/admin/inventory?durum=riskli"
              prefetch={false}
              className="hidden items-center gap-1.5 rounded-full border border-shell/40 bg-shell/10 px-3 py-1.5 text-xs text-ink/75 transition-colors duration-200 hover:border-shell sm:inline-flex"
            >
              <TriangleAlert className="h-3.5 w-3.5 text-shell" aria-hidden="true" />
              <span className="figure">{stockAlerts}</span>
              <span>stok uyarısı</span>
            </Link>
          )}

          <div className="hidden min-w-0 items-center gap-3 border-l border-ink/10 pl-3 md:flex">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm leading-tight text-ink">{session.displayName}</p>
              <p className="label text-olive">{ROLE_LABELS[session.role]}</p>
            </div>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-11 items-center rounded-full px-3 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
            >
              Çıkış
            </button>
          </form>
        </div>
      </header>

      <MobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={items}
        pathname={pathname}
        session={session}
        alerts={alerts}
      />
    </>
  )
}

function GlobalSearch() {
  const router = useRouter()
  const [value, setValue] = useState("")

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        const q = value.trim()
        if (q.length < 2) return
        router.push(`/admin/search?q=${encodeURIComponent(q)}`)
      }}
      className="hidden lg:block"
    >
      <label htmlFor="admin-global-search" className="sr-only">
        Ürün, sipariş veya müşteri ara
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35"
        />
        <input
          id="admin-global-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ürün, sipariş, müşteri…"
          autoComplete="off"
          className="min-h-11 w-56 rounded-full border border-ink/15 bg-paper/50 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40 xl:w-64"
        />
      </div>
    </form>
  )
}

/**
 * Slide-in navigation, built on <dialog> so focus trapping, Escape and focus
 * restoration come from the platform.
 */
function MobileNav({
  open,
  onClose,
  items,
  pathname,
  session,
  alerts,
}: {
  open: boolean
  onClose: () => void
  items: AdminNavItem[]
  pathname: string
  session: ShellSession
  alerts: ShellAlerts
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.addEventListener("close", onClose)
    return () => dialog.removeEventListener("close", onClose)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-label="Yönetim menüsü"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
      className="m-0 h-dvh max-h-dvh w-[min(18rem,85vw)] max-w-none border-r border-ink/10 bg-ivory p-0 text-ink backdrop:bg-ink/40 lg:hidden"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink/10 px-4">
          <BrandMark collapsed={false} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Menüyü kapat"
            className="flex h-11 w-11 items-center justify-center text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavList
            items={items}
            pathname={pathname}
            alerts={alerts}
            onNavigate={() => dialogRef.current?.close()}
          />
        </nav>

        <div className="shrink-0 border-t border-ink/10 px-4 py-4">
          <p className="truncate text-sm text-ink">{session.displayName}</p>
          <p className="label text-olive">{ROLE_LABELS[session.role]}</p>
          <Link
            href="/"
            onClick={() => dialogRef.current?.close()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-ink/55 transition-colors duration-200 hover:text-ink"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Mağazayı gör
          </Link>
        </div>
      </div>
    </dialog>
  )
}
