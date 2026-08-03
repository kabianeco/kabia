import type { AdminRole, Permission } from "@/lib/admin/roles"
import { can } from "@/lib/admin/roles"

/**
 * The dashboard's navigation, declared once.
 *
 * `permission` is what hides an item from someone who cannot use it — but
 * hiding is a courtesy, not a control. Every route behind these links verifies
 * the same permission on the server, and the database verifies it again.
 */

export type AdminNavIcon =
  | "overview"
  | "products"
  | "categories"
  | "inventory"
  | "orders"
  | "customers"
  | "media"
  | "content"
  | "blog"
  | "appearance"
  | "settings"
  | "administrators"
  | "audit"

export interface AdminNavItem {
  href: string
  label: string
  icon: AdminNavIcon
  permission?: Permission
  /** Matches nested routes as well as the exact path. */
  matchPrefix?: boolean
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Genel Bakış", icon: "overview" },
  { href: "/admin/products", label: "Ürünler", icon: "products", permission: "manageCatalogue", matchPrefix: true },
  { href: "/admin/categories", label: "Kategoriler", icon: "categories", permission: "manageCategories", matchPrefix: true },
  { href: "/admin/inventory", label: "Stok", icon: "inventory", permission: "manageInventory", matchPrefix: true },
  { href: "/admin/orders", label: "Siparişler", icon: "orders", permission: "manageOrders", matchPrefix: true },
  { href: "/admin/customers", label: "Müşteriler", icon: "customers", permission: "viewCustomers", matchPrefix: true },
  { href: "/admin/media", label: "Medya", icon: "media", permission: "manageMedia", matchPrefix: true },
  { href: "/admin/content", label: "İçerik", icon: "content", permission: "manageContent", matchPrefix: true },
  { href: "/admin/blog", label: "Blog", icon: "blog", permission: "manageBlog", matchPrefix: true },
  { href: "/admin/appearance", label: "Görünüm", icon: "appearance", permission: "manageTheme", matchPrefix: true },
  { href: "/admin/settings", label: "Ayarlar", icon: "settings", permission: "manageSettings", matchPrefix: true },
  {
    href: "/admin/administrators",
    label: "Yöneticiler",
    icon: "administrators",
    permission: "manageAdministrators",
    matchPrefix: true,
  },
  { href: "/admin/audit-logs", label: "Denetim Kayıtları", icon: "audit", matchPrefix: true },
]

export function navForRole(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.permission || can(role, item.permission))
}

export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.matchPrefix) return pathname === item.href || pathname.startsWith(`${item.href}/`)
  return pathname === item.href
}

/** The section label for the top bar, derived from the current path. */
export function currentSectionLabel(pathname: string): string {
  const match = [...ADMIN_NAV]
    .filter((item) => isNavItemActive(item, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.label ?? "Yönetim"
}
