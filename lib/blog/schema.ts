import { z } from "zod"
import { slugSchema, uuid } from "@/lib/admin/schemas"
import { blogContentSchema } from "@/lib/blog/content"
import { BLOG_POST_STATUSES } from "@/lib/blog/types"

export const blogPostSchema = z.object({
  title: z.string().trim().min(2, "Başlık en az 2 karakter olmalı.").max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(400, "Özet en fazla 400 karakter olabilir.").optional().nullable(),
  content_json: z.string().min(1, "İçerik boş olamaz.").transform((raw, ctx) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      ctx.addIssue({ code: "custom", message: "İçerik okunamadı." })
      return z.NEVER
    }
    const result = blogContentSchema.safeParse(parsed)
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "İçerik yapısı geçersiz." })
      return z.NEVER
    }
    return result.data
  }),
  category_id: uuid.optional().nullable(),
  cover_media_id: uuid.optional().nullable(),
  cover_image_path: z.string().trim().max(500).optional().nullable(),
  og_media_id: uuid.optional().nullable(),
  og_image_path: z.string().trim().max(500).optional().nullable(),
  featured: z.boolean(),
  allow_indexing: z.boolean(),
  author_name: z.string().trim().max(120).optional().nullable(),
  seo_title: z.string().trim().max(70, "SEO başlığı en fazla 70 karakter.").optional().nullable(),
  seo_description: z.string().trim().max(200, "SEO açıklaması en fazla 200 karakter.").optional().nullable(),
  canonical_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => !v || v.startsWith("/") || /^https?:\/\//.test(v), {
      message: "Kanonik adres / ile başlamalı ya da http(s):// içermeli.",
    }),
  // Submitted as a JSON-array string, the same array-via-hidden-field pattern
  // product variants/images use (FormData has no natural array shape).
  tag_ids: z.string().transform((raw, ctx) => {
    if (raw.trim() === "") return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      ctx.addIssue({ code: "custom", message: "Etiketler okunamadı." })
      return z.NEVER
    }
    const result = z.array(uuid).max(20, "En fazla 20 etiket eklenebilir.").safeParse(parsed)
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "Etiketler okunamadı." })
      return z.NEVER
    }
    return result.data
  }),
})

export type BlogPostInput = z.infer<typeof blogPostSchema>

export const blogPostIdSchema = z.object({ postId: uuid })

export const blogScheduleSchema = z.object({
  postId: uuid,
  scheduled_at: z
    .string()
    .min(1, "Zamanlama tarihi gerekli.")
    .transform((raw, ctx) => {
      // `<input type="datetime-local">` submits "YYYY-MM-DDTHH:mm" with no
      // offset, which `new Date()` would otherwise parse in the *server's*
      // timezone rather than the store's. Turkey has used a fixed UTC+3
      // offset (no DST) since 2016, so it is anchored explicitly here —
      // the same reasoning lib/admin/format.ts uses for day bucketing.
      const date = new Date(`${raw}:00+03:00`)
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Geçersiz tarih." })
        return z.NEVER
      }
      if (date.getTime() <= Date.now()) {
        ctx.addIssue({ code: "custom", message: "Zamanlama tarihi gelecekte olmalı." })
        return z.NEVER
      }
      return date.toISOString()
    }),
})

export const blogCategorySchema = z.object({
  name: z.string().trim().min(2, "Kategori adı en az 2 karakter olmalı.").max(80),
  slug: slugSchema,
  description: z.string().trim().max(400).optional().nullable(),
  image_media_id: uuid.optional().nullable(),
  image_path: z.string().trim().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.boolean(),
})

export const blogTagSchema = z.object({
  name: z.string().trim().min(1, "Etiket adı gerekli.").max(60),
  slug: slugSchema,
})

export const blogStatusFilterSchema = z.enum(BLOG_POST_STATUSES)

export const blogAdminListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(BLOG_POST_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
  sort: z.enum(["updated_at", "published_at", "title"]).catch("updated_at"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})
