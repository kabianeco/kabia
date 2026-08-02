import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { site } from "@/lib/site"

/**
 * Store settings, as the *public* application sees them.
 *
 * Read with a plain anon client rather than the cookie-bound server client:
 * the result is shared across every visitor, so it must not depend on who is
 * asking. RLS limits an anonymous read to rows flagged `is_public`, which is
 * exactly the subset the storefront is allowed to render.
 *
 * Cached under a tag so the admin settings screen can invalidate it the moment
 * a value changes — that is what makes a settings edit show up on the public
 * site without a redeployment. The 5-minute ceiling is a backstop, not the
 * mechanism.
 *
 * Every field falls back to the value already hard-coded in lib/site.ts, so a
 * database outage degrades the storefront to its previous behaviour instead of
 * blanking the footer.
 */

export const SETTINGS_TAG = "site-settings"

export interface PublicSettings {
  storeName: string
  supportEmail: string
  supportPhone: string
  currency: string
  timezone: string
  freeShippingThreshold: number
  shippingFlatRate: number
  shippingMessage: string
  storeOpen: boolean
  checkoutEnabled: boolean
  maintenanceMessage: string
  announcementEnabled: boolean
  announcementText: string
  contactAddress: string
  supportHours: string
  socialInstagram: string
  socialFacebook: string
  socialX: string
  seoDefaultTitle: string
  seoDefaultDescription: string
  seoSocialImage: string
  shopBannerEnabled: boolean
  shopBannerHeadline: string
  shopBannerSubtext: string
  shopBannerImageUrl: string
  shopBannerCtaLabel: string
  shopBannerCtaHref: string
}

export const SETTINGS_FALLBACK: PublicSettings = {
  storeName: site.name,
  supportEmail: site.email,
  supportPhone: site.phone,
  currency: "TRY",
  timezone: "Europe/Istanbul",
  freeShippingThreshold: 500,
  shippingFlatRate: 29.9,
  shippingMessage: "500 ₺ ve üzeri siparişlerde kargo ücretsiz.",
  storeOpen: true,
  checkoutEnabled: true,
  maintenanceMessage: "",
  announcementEnabled: false,
  announcementText: "",
  contactAddress: site.address,
  supportHours: "Hafta içi 09:00 – 18:00",
  socialInstagram: site.social.instagram,
  socialFacebook: site.social.facebook,
  socialX: site.social.x,
  seoDefaultTitle: "Kabia Ekolojik | Geyve'den Ekolojik Badem",
  seoDefaultDescription:
    "Sakarya Geyve'de, kimyasal gübre ve ilaç kullanılmadan yetiştirilen badem. Katkısız ürünler, tek kaynaktan.",
  seoSocialImage: "/images/almonds-drying.jpg",
  shopBannerEnabled: false,
  shopBannerHeadline: "",
  shopBannerSubtext: "",
  shopBannerImageUrl: "",
  shopBannerCtaLabel: "",
  shopBannerCtaHref: "",
}

/** setting key → the PublicSettings field it populates. */
const KEY_MAP: Record<string, keyof PublicSettings> = {
  store_name: "storeName",
  support_email: "supportEmail",
  support_phone: "supportPhone",
  currency: "currency",
  timezone: "timezone",
  free_shipping_threshold: "freeShippingThreshold",
  shipping_flat_rate: "shippingFlatRate",
  shipping_message: "shippingMessage",
  store_open: "storeOpen",
  checkout_enabled: "checkoutEnabled",
  maintenance_message: "maintenanceMessage",
  announcement_enabled: "announcementEnabled",
  announcement_text: "announcementText",
  contact_address: "contactAddress",
  support_hours: "supportHours",
  social_instagram: "socialInstagram",
  social_facebook: "socialFacebook",
  social_x: "socialX",
  seo_default_title: "seoDefaultTitle",
  seo_default_description: "seoDefaultDescription",
  seo_social_image: "seoSocialImage",
  shop_banner_enabled: "shopBannerEnabled",
  shop_banner_headline: "shopBannerHeadline",
  shop_banner_subtext: "shopBannerSubtext",
  shop_banner_image_url: "shopBannerImageUrl",
  shop_banner_cta_label: "shopBannerCtaLabel",
  shop_banner_cta_href: "shopBannerCtaHref",
}

async function readPublicSettings(): Promise<PublicSettings> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return SETTINGS_FALLBACK

  try {
    const client = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await client.from("site_settings").select("key, value, value_type")
    if (error || !data) return SETTINGS_FALLBACK

    const result: PublicSettings = { ...SETTINGS_FALLBACK }
    for (const row of data as { key: string; value: unknown; value_type: string }[]) {
      const field = KEY_MAP[row.key]
      if (!field) continue
      const raw = row.value
      if (row.value_type === "number" && typeof raw === "number") {
        ;(result[field] as number) = raw
      } else if (row.value_type === "boolean" && typeof raw === "boolean") {
        ;(result[field] as boolean) = raw
      } else if (row.value_type === "string" && typeof raw === "string") {
        // An empty string means "unset" for optional copy, so keep the fallback
        // only where a blank would look broken.
        ;(result[field] as string) = raw
      }
    }
    return result
  } catch {
    return SETTINGS_FALLBACK
  }
}

export const getPublicSettings = unstable_cache(readPublicSettings, ["kabia-site-settings"], {
  tags: [SETTINGS_TAG],
  revalidate: 300,
})
