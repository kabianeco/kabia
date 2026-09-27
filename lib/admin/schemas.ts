import { z } from "zod"
import { APP_ROLES } from "@/lib/admin/roles"
import { newPasswordField } from "@/lib/auth/password-policy"
import { PRODUCT_CERTIFICATIONS, PRODUCT_SOURCES } from "@/lib/products"
import { MEDIA_MAX_BYTES } from "@/lib/admin/media"
import { isAllowedImageUrl } from "@/lib/shop-banner"

/**
 * S24: image URLs must live where next/image can serve them (site-relative
 * path, picsum, or Supabase storage) — an unlisted host throws at render
 * time and takes down the whole route. All stored URLs pass this today
 * (verified live), so the check only stops newly bad values.
 */
const IMAGE_HOST_MESSAGE =
  "Görsel adresi site içi bir yol ya da kayıtlı bir barındırıcıda olmalı."

/**
 * Every administrative mutation validates through one of these before touching
 * the database. Nothing here trusts a hidden form field: there is deliberately
 * no schema for "acting administrator id", "acting role", "current price",
 * "current stock" or "order ownership — those are always re-read on the server.
 */

export const uuid = z.string().uuid({ message: "Geçersiz kayıt kimliği." })

export const slugSchema = z
  .string()
  .trim()
  .min(2, "Kısa ad en az 2 karakter olmalı.")
  .max(80, "Kısa ad en fazla 80 karakter olabilir.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Kısa ad yalnızca küçük harf, rakam ve tire içerebilir (ör. cig-badem-500g).",
  )
  // S23: the onizleme- prefix is reserved for preview fixtures and must never
  // become a real product/producer slug (mirrored by a DB CHECK constraint).
  .refine((v) => !v.startsWith("onizleme-"), {
    message: "Kısa ad önizleme önekiyle (onizleme-) başlayamaz.",
  })

/**
 * Money and counts arrive from text inputs, so parsing is done explicitly
 * rather than with `z.coerce`, whose input type is `unknown` and therefore
 * cannot be piped from a string transform. Turkish keyboards produce a decimal
 * comma, which is normalised here.
 */
function parseDecimal(raw: string, label: string, ctx: z.RefinementCtx): number | typeof z.NEVER {
  const n = Number(raw.replace(",", "."))
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: "custom", message: `${label} sayı olmalı.` })
    return z.NEVER
  }
  if (n < 0) {
    ctx.addIssue({ code: "custom", message: `${label} negatif olamaz.` })
    return z.NEVER
  }
  if (n > 999_999.99) {
    ctx.addIssue({ code: "custom", message: `${label} çok yüksek.` })
    return z.NEVER
  }
  return n
}

const priceField = (label: string) =>
  z.string().trim().transform((raw, ctx) => {
    if (raw === "") {
      ctx.addIssue({ code: "custom", message: `${label} zorunlu.` })
      return z.NEVER
    }
    return parseDecimal(raw, label, ctx)
  })

const optionalPriceField = (label: string) =>
  z
    .string()
    .trim()
    .transform((raw, ctx): number | null | typeof z.NEVER => {
      if (raw === "") return null
      return parseDecimal(raw, label, ctx)
    })

/** Integer text input shared by the entity screens (sıra fields). */
export const intField = (label: string, min: number, max: number) =>
  z.union([z.string(), z.number()]).transform((raw, ctx) => {
    const n = typeof raw === "number" ? raw : Number(raw.trim())
    if (!Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: `${label} tam sayı olmalı.` })
      return z.NEVER
    }
    if (n < min) {
      ctx.addIssue({ code: "custom", message: `${label} en az ${min} olabilir.` })
      return z.NEVER
    }
    if (n > max) {
      ctx.addIssue({ code: "custom", message: `${label} en fazla ${max} olabilir.` })
      return z.NEVER
    }
    return n
  })

export const variantSchema = z.object({
  id: uuid.optional().nullable(),
  label: z.string().trim().min(1, "Seçenek adı zorunlu.").max(60),
  price: priceField("Fiyat"),
  stock_quantity: intField("Stok", 0, 1_000_000),
  sku: z
    .string()
    .trim()
    .max(64, "SKU en fazla 64 karakter olabilir.")
    .regex(/^[A-Za-z0-9._-]*$/, "SKU yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir.")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
})

/**
 * `variantSchema` after its transforms have run.
 *
 * The editor submits variants as a JSON string, which the save action parses
 * with `variantSchema` *before* validating the product as a whole. That parse
 * turns `price` from the form's string into a number. Re-running
 * `variantSchema` inside `productSchema` on that already-transformed array then
 * fed a number to `priceField`, which begins with `z.string()`, and every save
 * failed with "expected string, received number" — no product with a variant
 * could be saved at all.
 *
 * So `productSchema` validates the *output* shape rather than the input shape.
 * The two are declared next to each other deliberately: they have to move
 * together.
 */
export const parsedVariantSchema = z.object({
  id: uuid.optional().nullable(),
  label: z.string().trim().min(1, "Seçenek adı zorunlu.").max(60),
  price: z.number().nonnegative("Fiyat negatif olamaz."),
  stock_quantity: z.number().int("Stok tam sayı olmalı.").min(0).max(1_000_000),
  sku: z.string().max(64).nullable().optional(),
})

export const imageSchema = z.object({
  id: uuid.optional().nullable(),
  image_url: z.string().trim().min(1, "Görsel adresi zorunlu.").max(1000).refine(isAllowedImageUrl, {
    message: IMAGE_HOST_MESSAGE,
  }),
  alt_text: z.string().trim().max(200, "Alternatif metin en fazla 200 karakter.").optional().nullable(),
  sort_order: intField("Sıra", 0, 999),
  storage_path: z.string().trim().max(500).optional().nullable(),
})

/**
 * Optional free-text provenance fields. They arrive from text inputs, so an
 * untouched input is "" and must become SQL NULL rather than an empty string —
 * the product page hides a row whose value is null, and would otherwise print
 * an empty "Çeşit" line for every product nobody filled in.
 */
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null)

/** A harvest season, or nothing. Bounded so a typo cannot become a claim. */
const harvestYearField = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((raw, ctx): number | null | typeof z.NEVER => {
    if (raw === null || raw === undefined) return null
    const text = typeof raw === "number" ? String(raw) : raw.trim()
    if (text === "") return null
    const n = Number(text)
    if (!Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", message: "Hasat yılı tam sayı olmalı." })
      return z.NEVER
    }
    if (n < 1900 || n > 2099) {
      ctx.addIssue({ code: "custom", message: "Hasat yılı 1900 ile 2099 arasında olmalı." })
      return z.NEVER
    }
    return n
  })

/** A producer reference, or none. Never a slug — the column is a uuid FK. */
const producerIdField = z
  .string()
  .trim()
  .nullish()
  .transform((raw, ctx): string | null | typeof z.NEVER => {
    if (!raw || raw === "") return null
    if (!z.string().uuid().safeParse(raw).success) {
      ctx.addIssue({ code: "custom", message: "Geçersiz üretici kaydı." })
      return z.NEVER
    }
    return raw
  })

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Ürün adı en az 2 karakter olmalı.").max(120),
    slug: slugSchema,
    category_id: uuid,
    short_description: z.string().trim().min(1, "Kısa açıklama zorunlu.").max(300),
    description: z.string().trim().min(1, "Açıklama zorunlu.").max(5000),
    base_price: priceField("Temel fiyat"),
    original_price: optionalPriceField("Liste fiyatı"),
    main_image_url: z.string().trim().min(1, "Ana görsel zorunlu.").max(1000).refine(isAllowedImageUrl, {
      message: IMAGE_HOST_MESSAGE,
    }),
    origin: z.string().trim().max(200).optional().nullable(),
    production_method: z.string().trim().max(200).optional().nullable(),
    shelf_life: z.string().trim().max(200).optional().nullable(),
    storage_conditions: z.string().trim().max(300).optional().nullable(),
    certifications: z.string().trim().max(300).optional().nullable(),
    is_active: z.boolean(),
    is_featured: z.boolean(),
    low_stock_threshold: intField("Kritik stok eşiği", 0, 100_000),
    display_order: intField("Sıra", 0, 9999),
    seo_title: z.string().trim().max(70, "SEO başlığı en fazla 70 karakter.").optional().nullable(),
    seo_description: z
      .string()
      .trim()
      .max(200, "SEO açıklaması en fazla 200 karakter.")
      .optional()
      .nullable(),

    // ---- taxonomy and provenance -------------------------------------------
    // `source` and `certification` are database enums, and `certification` is
    // NOT NULL with no default: omitting it from the payload is what made every
    // product creation fail with 23502. Neither is optional here, and neither
    // has a fallback value — an unrecognised certification is rejected rather
    // than being quietly resolved, because one of the three is a legal claim.
    source: z.enum(PRODUCT_SOURCES, { message: "Geçersiz kaynak." }),
    certification: z.enum(PRODUCT_CERTIFICATIONS, { message: "Geçersiz sertifika değeri." }),
    producer_id: producerIdField,
    harvest_year: harvestYearField,
    lot_code: optionalText("Lot kodu", 60),
    variety: optionalText("Çeşit", 80),
    rootstock: optionalText("Anaç", 80),
    processing: optionalText("İşleme", 200),
    allergens: optionalText("Alerjenler", 200),
    net_weight: optionalText("Net ağırlık", 60),

    variants: z.array(parsedVariantSchema).min(1, "En az bir ürün seçeneği gerekli."),
  })
  .superRefine((value, ctx) => {
    if (value.original_price !== null && value.original_price !== undefined) {
      if (value.original_price <= value.base_price) {
        ctx.addIssue({
          code: "custom",
          path: ["original_price"],
          message: "Liste fiyatı, temel fiyattan yüksek olmalı (indirim göstermek için).",
        })
      }
    }
    const labels = value.variants.map((v) => v.label.toLocaleLowerCase("tr"))
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Seçenek adları benzersiz olmalı." })
    }
    const skus = value.variants.map((v) => v.sku).filter((s): s is string => !!s)
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "SKU değerleri benzersiz olmalı." })
    }
    if (!value.variants.some((v) => v.price === value.base_price)) {
      ctx.addIssue({
        code: "custom",
        path: ["base_price"],
        message: "Temel fiyat, seçeneklerden birinin fiyatıyla eşleşmeli.",
      })
    }
  })

export const nutritionSchema = z.object({
  calories: z.string().trim().max(40).optional().nullable(),
  protein: z.string().trim().max(40).optional().nullable(),
  carbohydrates: z.string().trim().max(40).optional().nullable(),
  fat: z.string().trim().max(40).optional().nullable(),
  fiber: z.string().trim().max(40).optional().nullable(),
  sodium: z.string().trim().max(40).optional().nullable(),
})

export const stockAdjustmentSchema = z
  .object({
    variant_id: uuid,
    direction: z.enum(["increase", "decrease"], { message: "Yön seçilmeli." }),
    quantity: intField("Miktar", 1, 100_000),
    reason: z.string().trim().min(3, "Gerekçe en az 3 karakter olmalı.").max(120),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .transform((v) => ({
    variant_id: v.variant_id,
    change: v.direction === "increase" ? v.quantity : -v.quantity,
    reason: v.reason,
    note: v.note && v.note.length > 0 ? v.note : null,
  }))

export const ORDER_STATUSES = ["hazirlaniyor", "kargoda", "teslim_edildi", "iptal_edildi"] as const
export type OrderStatusValue = (typeof ORDER_STATUSES)[number]

export const orderStatusSchema = z.object({
  order_id: uuid,
  status: z.enum(ORDER_STATUSES, { message: "Geçersiz sipariş durumu." }),
  note: z.string().trim().max(2000).optional().nullable(),
})

export const orderNoteSchema = z.object({
  order_id: uuid,
  note: z.string().trim().min(1, "Not boş olamaz.").max(2000, "Not en fazla 2000 karakter."),
})

export const overrideOrderStatusSchema = z.object({
  order_id: uuid,
  status: z.enum(ORDER_STATUSES, { message: "Geçersiz sipariş durumu." }),
  reason: z.string().trim().min(3, "Gerekçe en az 3 karakter olmalı.").max(500, "Gerekçe en fazla 500 karakter."),
})

export const orderTrackingSchema = z.object({
  order_id: uuid,
  tracking_carrier: z
    .string()
    .trim()
    .max(64)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  tracking_number: z
    .string()
    .trim()
    .max(64)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
})

export const orderEmailResendSchema = z.object({
  order_id: uuid,
  kind: z.enum(["order_received", "order_shipped", "order_delivered", "order_cancelled"], {
    message: "Geçersiz e-posta türü.",
  }),
})

export type OrderEmailResendInput = z.infer<typeof orderEmailResendSchema>

/**
 * Settings are validated against the row's declared type, which is read from
 * the database — the form cannot decide that a boolean setting is now a string.
 */
export const settingValueSchemas = {
  string: z.string().trim().max(500, "En fazla 500 karakter."),
  number: z
    .string()
    .trim()
    .transform((raw, ctx) => {
      const n = Number(raw.replace(",", "."))
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: "Sayı olmalı." })
        return z.NEVER
      }
      if (n < 0) {
        ctx.addIssue({ code: "custom", message: "Negatif olamaz." })
        return z.NEVER
      }
      if (n > 9_999_999) {
        ctx.addIssue({ code: "custom", message: "Çok yüksek." })
        return z.NEVER
      }
      return n
    }),
  boolean: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
} as const

export const settingKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{2,60}$/, "Geçersiz ayar anahtarı.")

export const administratorInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
  full_name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı.").max(120),
  role: z.enum(["admin", "super_admin"], { message: "Geçersiz rol." }),
})

export const roleChangeSchema = z.object({
  user_id: uuid,
  role: z.enum(APP_ROLES).refine((r) => r !== "customer" || true, { message: "Geçersiz rol." }),
})

export const administratorStateSchema = z.object({
  user_id: uuid,
  is_active: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
})

export const passwordChangeSchema = z
  .object({
    password: z
      .string()
      .min(12, "Parola en az 12 karakter olmalı.")
      .max(72, "Parola en fazla 72 karakter olabilir.")
      .regex(/[a-z]/, "Parola en az bir küçük harf içermeli.")
      .regex(/[A-Z]/, "Parola en az bir büyük harf içermeli.")
      .regex(/[0-9]/, "Parola en az bir rakam içermeli."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Parolalar eşleşmiyor.",
  })

export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const

// The size limit is defined once, in lib/admin/media.ts, next to the bucket
// name it must agree with. Re-exported here so existing importers of this
// module keep working and the two cannot drift to different numbers.
export { MEDIA_MAX_BYTES }

export const mediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(MEDIA_MIME_TYPES, {
    message: "Yalnızca JPEG, PNG, WebP ve AVIF görselleri yüklenebilir.",
  }),
  size: z
    .number()
    .int()
    .positive("Dosya boş.")
    .max(MEDIA_MAX_BYTES, "Dosya 10 MB sınırını aşıyor."),
  alt_text: z.string().trim().max(200).optional().nullable(),
})

/** Metadata an administrator may edit after upload. */
export const mediaMetadataSchema = z.object({
  id: uuid,
  display_name: z.string().trim().max(120).nullish().transform((v) => v || null),
  alt_text: z.string().trim().max(200).nullish().transform((v) => v || null),
})

/** List-screen query parameters. Bounded by construction. */
export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
  sort: z.string().trim().max(40).optional(),
  dir: z.enum(["asc", "desc"]).catch("desc"),
})

/**
 * Producer editor input.
 *
 * Producers are flat — no variants, gallery, scheduling, SEO or rich text —
 * so this is one object, not the four-place contract products need. `source`
 * is a database enum with no fallback value: an unrecognised line is rejected
 * rather than being quietly filed under the farm. `desc` is the one-line card
 * copy `/secki` prints under the name; the story keeps blank-line paragraph
 * breaks as authored (see splitStoryParagraphs) and is length-bounded only.
 */
export const producerSchema = z.object({
  name: z.string().trim().min(2, "Üretici adı en az 2 karakter olmalı.").max(120),
  slug: slugSchema,
  source: z.enum(PRODUCT_SOURCES, { message: "Geçersiz kaynak." }),
  tagline: z.string().trim().min(2, "Tek satırlık tanıtım en az 2 karakter olmalı.").max(200),
  region: optionalText("Bölge", 200),
  product_type: optionalText("Ürün türü", 120),
  photo_url: optionalText("Fotoğraf", 1000).refine((v) => v == null || isAllowedImageUrl(v), {
    message: IMAGE_HOST_MESSAGE,
  }),
  story: z.string().trim().max(8000, "Hikâye en fazla 8000 karakter olabilir.").nullish().transform((v) => v || null),
  production_place: optionalText("Üretim yeri", 300),
  method: optionalText("Yöntem", 1000),
  inputs: optionalText("Girdiler", 1000),
  certificates: optionalText("Belgeler", 1000),
  why_selected: optionalText("Neden seçildi", 1000),
  is_published: z.boolean(),
  sort_order: intField("Sıra", 0, 9999),
})

export type ProductInput = z.infer<typeof productSchema>
export type ProducerInput = z.infer<typeof producerSchema>
export type VariantInput = z.infer<typeof variantSchema>
export type ImageInput = z.infer<typeof imageSchema>

/** Zod issues → the flat `{ field: message }` shape the forms render. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form"
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/**
 * Yönetici sipariş oluşturma (Feature 2 — /admin/orders/yeni).
 *
 * Fiyatlar formdan alınmaz: kalemlerde yalnızca variant_id + adet taşınır,
 * birim fiyat ve stok denetimi admin_create_order içinde veritabanından
 * okunur. Ödeme yalnızca kapıda ödeme ve havale/EFT; kart alınmaz.
 */
export const ADMIN_ORDER_PAYMENT_METHODS = ["cod", "bank_transfer"] as const
export type AdminOrderPaymentMethod = (typeof ADMIN_ORDER_PAYMENT_METHODS)[number]

export const ADMIN_ORDER_PAYMENT_LABELS: Record<AdminOrderPaymentMethod, string> = {
  cod: "Kapıda ödeme",
  bank_transfer: "Havale / EFT",
}

const adminOrderItemSchema = z.object({
  variant_id: uuid,
  quantity: z.number().int("Adet tam sayı olmalı.").min(1, "Adet en az 1 olmalı.").max(99, "Adet en fazla 99 olabilir."),
})

const adminOrderAddressSchema = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  recipientName: z.string().trim().min(2, "Alıcı adı en az 2 karakter olmalı.").max(160),
  phone: z.string().trim().min(7, "Telefon en az 7 karakter olmalı.").max(32),
  addressLine1: z.string().trim().min(4, "Adres en az 4 karakter olmalı.").max(500),
  addressLine2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().min(2, "İl gerekli.").max(80),
  district: z.string().trim().min(2, "İlçe gerekli.").max(80),
  postalCode: z.string().trim().max(20).optional().nullable(),
})

export const adminCreateOrderSchema = z.object({
  customer_id: uuid,
  items: z.array(adminOrderItemSchema).min(1, "En az bir kalem gerekli.").max(50, "En fazla 50 kalem olabilir."),
  shipping_address: adminOrderAddressSchema,
  payment_method: z.enum(ADMIN_ORDER_PAYMENT_METHODS, { message: "Geçersiz ödeme yöntemi." }),
  admin_note: z.string().trim().max(2000, "İç not en fazla 2000 karakter.").optional().nullable(),
  consent_note: z
    .string()
    .trim()
    .min(3, "Sözlü ya da kayıtlı onayın açık ifadesi gerekli (en az 3 karakter).")
    .max(500, "Onam beyanı en fazla 500 karakter."),
})

export type AdminCreateOrderInput = z.infer<typeof adminCreateOrderSchema>

export const customerNumberLookupSchema = z.object({
  customer_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^KE-[0-9]{6}$/, "Müşteri numarası KE-###### biçiminde olmalı."),
})

/**
 * Feature 3 — müşteri parola işlemleri.
 *
 * 3a (recovery bağlantısı) yalnızca müşteri kimliği taşır; e-posta sunucuda
 * Auth Admin API'den okunur, forma güvenilmez. 3b (doğrudan şifre) süper
 * yöneticiye özeldir: gerekçe zorunlu, parola ya sunucuda üretilir ya da
 * müşteri parolalarıyla aynı kuralla (en az 8) elle girilir.
 */
export const customerIdParamSchema = z.object({
  customer_id: uuid,
})

export const ADMIN_PASSWORD_MODES = ["generate", "manual"] as const

export const adminSetCustomerPasswordSchema = z
  .object({
    customer_id: uuid,
    reason: z
      .string()
      .trim()
      .min(3, "Gerekçe en az 3 karakter olmalı.")
      .max(500, "Gerekçe en fazla 500 karakter."),
    mode: z.enum(ADMIN_PASSWORD_MODES, { message: "Parola yöntemi seçilmeli." }),
    password: z.string().max(72).optional().nullable(),
    confirm: z.string().max(72).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "manual") return
    // Müşteri parolalarıyla aynı kural (lib/auth/password-policy.ts, en az 8):
    // tek doğruluk kaynağı newPasswordField'dır.
    const checked = newPasswordField.safeParse(v.password ?? "")
    if (!checked.success) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: checked.error.issues[0]?.message ?? "Geçersiz şifre.",
      })
      return
    }
    if ((v.confirm ?? "") !== (v.password ?? "")) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Parolalar eşleşmiyor." })
    }
  })
