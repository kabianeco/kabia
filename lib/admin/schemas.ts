import { z } from "zod"
import { APP_ROLES } from "@/lib/admin/roles"
import { MEDIA_MAX_BYTES } from "@/lib/admin/media"

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

const intField = (label: string, min: number, max: number) =>
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
  image_url: z.string().trim().min(1, "Görsel adresi zorunlu.").max(1000),
  alt_text: z.string().trim().max(200, "Alternatif metin en fazla 200 karakter.").optional().nullable(),
  sort_order: intField("Sıra", 0, 999),
  storage_path: z.string().trim().max(500).optional().nullable(),
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
    main_image_url: z.string().trim().min(1, "Ana görsel zorunlu.").max(1000),
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

export type ProductInput = z.infer<typeof productSchema>
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
