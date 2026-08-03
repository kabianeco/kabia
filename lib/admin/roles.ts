/**
 * Role vocabulary shared by the server guards, the shell and the screens.
 *
 * Pure data and pure functions only — this module is safe to import from a
 * client component. It never reads a session; deciding *who* the caller is
 * happens on the server in lib/admin/auth.ts.
 */

export const APP_ROLES = ["customer", "admin", "super_admin"] as const
export type AppRole = (typeof APP_ROLES)[number]

/** The roles that grant access to the dashboard at all. */
export const ADMIN_ROLES = ["admin", "super_admin"] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "admin" || role === "super_admin"
}

export const ROLE_LABELS: Record<AppRole, string> = {
  customer: "Müşteri",
  admin: "Yönetici",
  super_admin: "Süper yönetici",
}

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  admin:
    "Ürün, stok, sipariş, müşteri, medya, içerik ve hassas olmayan ayarları yönetir.",
  super_admin:
    "Yönetici ekleyebilir, rol değiştirebilir, yetki kaldırabilir; hassas ayarlara ve tüm denetim kayıtlarına erişir.",
}

/**
 * Capabilities, named once so the shell, the guards and the screens cannot
 * drift apart. This mirrors the database policies — it does not replace them.
 */
export const PERMISSIONS = {
  manageCatalogue: ["admin", "super_admin"],
  manageCategories: ["admin", "super_admin"],
  manageInventory: ["admin", "super_admin"],
  manageOrders: ["admin", "super_admin"],
  viewCustomers: ["admin", "super_admin"],
  manageMedia: ["admin", "super_admin"],
  manageContent: ["admin", "super_admin"],
  manageBlog: ["admin", "super_admin"],
  manageSettings: ["admin", "super_admin"],
  manageTheme: ["admin", "super_admin"],
  manageSensitiveSettings: ["super_admin"],
  manageAdministrators: ["super_admin"],
  viewAllAuditLogs: ["super_admin"],
} as const satisfies Record<string, readonly AdminRole[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}
