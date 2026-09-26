"use server"

import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit"
import { reviewInputSchema } from "@/lib/reviews/schema"

/**
 * S18: the single review write path. The browser never inserts into reviews
 * directly anymore: this action validates (zod mirrors the DB CHECKs below),
 * rate-limits per IP + account, and inserts through the caller's own session
 * so RLS (reviews_insert_own: user_id = auth.uid()) stays a second boundary.
 * One review per user per product is enforced by uq_reviews_product_user and
 * surfaced as a Turkish message. Copy is byte-identical to the old panel.
 */
export interface ReviewSubmitState {
  ok: boolean
  message: string
}

export async function submitReviewAction(input: {
  product_id: string
  reviewer_name: string
  rating: number
  review_text: string
}): Promise<ReviewSubmitState> {
  const parsed = reviewInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false,
      message: first?.message ?? "Değerlendirme kaydedilemedi. Lütfen tekrar deneyin.",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Değerlendirme yazmak için giriş yapın." }
  }

  const h = await headers()
  const rl = await checkRateLimit("review_submit", getClientIp(h), user.email ?? user.id)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  // reviewer_name is validated but intentionally NOT persisted:
  // set_review_verification sources the display name from the account
  // profile (S17), so a caller-supplied name can never stick.
  const { error } = await supabase.from("reviews").insert({
    product_id: parsed.data.product_id,
    user_id: user.id,
    rating: parsed.data.rating,
    review_text: parsed.data.review_text,
  })
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Bu ürün için zaten değerlendirmeniz var." }
    }
    return { ok: false, message: "Değerlendirme kaydedilemedi. Lütfen tekrar deneyin." }
  }

  return { ok: true, message: "Değerlendirmeniz için teşekkürler." }
}
