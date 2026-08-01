import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Audit-log writer.
 *
 * There is no `adminUserId` parameter and there never should be: the database
 * function derives the acting administrator from `auth.uid()`. Passing an id
 * from the application would reintroduce exactly the spoofing risk the design
 * removes.
 *
 * Inventory adjustments and order status changes audit themselves inside their
 * own RPC, atomically with the change. This helper covers the mutations that go
 * through PostgREST, where the write and the audit are two statements — so it
 * reports failure to the caller rather than swallowing it.
 */

export type AuditAction =
  | "product.create"
  | "product.update"
  | "product.archive"
  | "product.restore"
  | "product.delete"
  | "product.media_attach"
  | "product.media_detach"
  | "category.create"
  | "category.update"
  | "category.delete"
  | "media.upload"
  | "media.delete"
  | "settings.update"
  | "content.update"
  | "order.note"
  | "order.tracking"
  | "administrator.create"
  | "administrator.role_change"
  | "administrator.deactivate"
  | "administrator.reactivate"
  | "administrator.password_change"
  | "admin.bootstrap"

export interface AuditEntry {
  action: AuditAction
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
}

/**
 * Returns true when the audit record was written. Callers surface a warning on
 * false — an unaudited administrative change is a problem worth showing, even
 * though the change itself succeeded.
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<boolean> {
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: entry.action,
    p_entity_type: entry.entityType,
    p_entity_id: entry.entityId ?? null,
    p_before: entry.before ?? null,
    p_after: entry.after ?? null,
    p_metadata: entry.metadata ?? null,
  })

  if (error) {
    console.error("[admin] audit write failed", { action: entry.action, error })
    return false
  }
  return true
}

export const AUDIT_WARNING =
  "İşlem tamamlandı, ancak denetim kaydı yazılamadı. Lütfen sistem yöneticisine bildirin."

/** Human-readable Turkish descriptions for the audit-log screen. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "product.create": "Ürün oluşturuldu",
  "product.update": "Ürün güncellendi",
  "product.archive": "Ürün arşivlendi",
  "product.restore": "Ürün yayına alındı",
  "product.delete": "Ürün silindi",
  "product.media_attach": "Ürüne görsel eklendi",
  "product.media_detach": "Üründen görsel kaldırıldı",
  "category.create": "Kategori oluşturuldu",
  "category.update": "Kategori güncellendi",
  "category.delete": "Kategori silindi",
  "inventory.adjust": "Stok güncellendi",
  "media.upload": "Medya yüklendi",
  "media.delete": "Medya silindi",
  "order.status_change": "Sipariş durumu değişti",
  "order.cancel": "Sipariş iptal edildi",
  "order.note": "Siparişe not eklendi",
  "order.tracking": "Kargo bilgisi güncellendi",
  "settings.update": "Ayar güncellendi",
  "content.update": "İçerik güncellendi",
  "administrator.create": "Yönetici oluşturuldu",
  "administrator.role_change": "Yönetici rolü değişti",
  "administrator.deactivate": "Yönetici yetkisi kaldırıldı",
  "administrator.reactivate": "Yönetici yetkisi geri verildi",
  "administrator.password_change": "Yönetici parolası değişti",
  "admin.bootstrap": "Kurulum yöneticisi oluşturuldu",
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  product: "Ürün",
  product_variant: "Ürün seçeneği",
  product_image: "Ürün görseli",
  category: "Kategori",
  order: "Sipariş",
  media: "Medya",
  setting: "Ayar",
  administrator: "Yönetici",
}

export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

export function describeAuditEntity(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType
}
