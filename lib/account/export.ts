import { ORDER_RECORD_RETENTION_YEARS } from "@/lib/account/retention"

/**
 * The personal-data export: what Kabia holds about one customer, as one JSON
 * document with a manifest. Built from rows already scoped to the customer;
 * this module only shapes them and states what is and is not included.
 *
 * Never included: passwords or hashes, session or refresh tokens, internal
 * rate-limit data, other people's data, administrator notes.
 */

export const EXPORT_FORMAT_VERSION = 1

export interface ExportSources {
  account: {
    id: string
    email: string
    created_at?: string | null
    email_confirmed_at?: string | null
    last_sign_in_at?: string | null
  }
  profile: Record<string, unknown> | null
  addresses: Record<string, unknown>[]
  notificationPreferences: Record<string, unknown> | null
  consents: Record<string, unknown>[]
  favorites: Record<string, unknown>[]
  reviews: Record<string, unknown>[]
  savedCardMetadata: Record<string, unknown>[]
  orders: Record<string, unknown>[]
}

/** Keys that must never appear in an export, at any depth. */
const FORBIDDEN_KEYS = new Set([
  "encrypted_password", "password", "password_hash", "access_token", "refresh_token",
  "token_hash", "confirmation_token", "recovery_token", "key_hash",
])

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue
      out[key] = scrub(inner)
    }
    return out
  }
  return value
}

export function buildExport(sources: ExportSources, generatedAt: Date) {
  return scrub({
    manifest: {
      service: "Kabia",
      format_version: EXPORT_FORMAT_VERSION,
      generated_at: generatedAt.toISOString(),
      subject: { account_id: sources.account.id, email: sources.account.email },
      sections: {
        account: "Hesap kimliği, e-posta ve oturum tarihleri",
        profile: "Ad soyad, telefon, doğum tarihi",
        addresses: "Kayıtlı teslimat adresleri",
        notification_preferences: "Bildirim tercihleri",
        consents: "Üyelik, KVKK ve ticari ileti onay kayıtları",
        favorites: "Favori ürünler",
        reviews: "Yazdığınız ürün değerlendirmeleri",
        saved_card_metadata: "Eski kart kayıtları (yalnızca marka, son dört hane, son kullanma)",
        orders: "Siparişler, sipariş kalemleri ve durum geçmişi",
      },
      not_included: [
        "Şifreniz ve oturum anahtarlarınız (hiçbir zaman dışa aktarılmaz)",
        "Kötüye kullanımı önlemek için tutulan anonim hız sınırı kayıtları",
        "Başka kişilere ait veriler ve yönetici notları",
      ],
      retention_note:
        `Hesabınızı silerseniz sipariş kayıtlarınız yasal saklama yükümlülüğü nedeniyle ` +
        `${ORDER_RECORD_RETENTION_YEARS} yıl saklanır; diğer veriler silinir.`,
    },
    account: sources.account,
    profile: sources.profile,
    addresses: sources.addresses,
    notification_preferences: sources.notificationPreferences,
    consents: sources.consents,
    favorites: sources.favorites,
    reviews: sources.reviews,
    saved_card_metadata: sources.savedCardMetadata,
    orders: sources.orders,
  })
}
