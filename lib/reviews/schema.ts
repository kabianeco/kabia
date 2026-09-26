import { z } from "zod"

/**
 * S18: review submission shape. Pure module so the accept/reject matrix is
 * unit-testable database-free. Bounds mirror the reviews_text_length /
 * reviews_name_length CHECK constraints; the schema is the readable error,
 * the constraints are the guarantee.
 */
export const reviewInputSchema = z.object({
  product_id: z.string().uuid("Geçersiz ürün."),
  reviewer_name: z.string().trim().min(1, "Adınızı yazın.").max(120, "Adınız çok uzun."),
  rating: z.number().int().min(1).max(5),
  review_text: z
    .string()
    .trim()
    .min(10, "Birkaç cümle yazın.")
    .max(2000, "Değerlendirmeniz çok uzun (en fazla 2000 karakter)."),
})

export type ReviewInput = z.infer<typeof reviewInputSchema>
