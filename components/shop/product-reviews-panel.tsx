"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField, TextAreaField } from "@/components/ui/field";
import { MotionRootLazy } from "@/components/motion/motion-root-lazy";
import { Monogram, Stars } from "@/components/shop/product-stars";
import { isPreviewItem } from "@/lib/preview-identity";
import { submitReviewAction } from "@/lib/reviews/actions";
import type { Product } from "@/lib/products";
import { EASE } from "@/lib/motion";

/**
 * The reviews tab. Loaded only when a visitor comes near the tabs or opens
 * this one (product-detail-islands.tsx), with its own motion root, so the
 * product page itself ships neither this form nor Framer Motion.
 */
export function ReviewsPanel({ product }: { product: Product }) {
  return (
    <MotionRootLazy>
      <ReviewsPanelContent product={product} />
    </MotionRootLazy>
  );
}

function ReviewsPanelContent({ product }: { product: Product }) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; text?: string }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPreviewItem(product)) return;
    const fd = new FormData(e.currentTarget);
    const reviewerName = String(fd.get("reviewerName") ?? "").trim();
    const reviewText = String(fd.get("reviewText") ?? "").trim();

    const nextErrors: typeof errors = {};
    if (!reviewerName) nextErrors.name = "Adınızı yazın.";
    if (!reviewText) nextErrors.text = "Birkaç cümle yazın.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    // S18: validated, rate-limited server action — the browser never writes
    // reviews directly. Copy below is unchanged from the direct-insert path.
    const result = await submitReviewAction({
      product_id: product.id,
      reviewer_name: reviewerName,
      rating: formRating,
      review_text: reviewText,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setSubmitted(true);
    setShowForm(false);
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[18rem_1fr] lg:gap-16">
      <div>
        <p className="flex items-baseline gap-2">
          <span className="figure text-5xl text-ink">
            {product.rating.toFixed(1)}
          </span>
          <span className="text-sm text-ink/50">/ 5</span>
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Stars value={product.rating} />
          <span className="text-sm text-ink/55">
            {product.reviewCount} değerlendirme
          </span>
        </div>

        <ul className="mt-8 space-y-2">
          {product.ratingBreakdown.map((pct, i) => {
            const star = 5 - i;
            return (
              <li key={star} className="flex items-center gap-3 text-xs">
                <span className="w-6 text-ink/55">{star}★</span>
                <span className="h-1 flex-1 overflow-hidden bg-ink/10">
                  <m.span
                    className="block h-full bg-brand"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: EASE, delay: i * 0.05 }}
                  />
                </span>
                <span className="figure w-9 text-right text-ink/55">{pct}%</span>
              </li>
            );
          })}
        </ul>

        {!showForm && !submitted && (
          <Button
            variant="outline"
            className="mt-8 w-full"
            onClick={() => setShowForm(true)}
          >
            Değerlendirme yaz
          </Button>
        )}
        {submitted && (
          <p className="mt-8 text-sm text-brand">
            Değerlendirmeniz için teşekkürler.
          </p>
        )}

        <AnimatePresence>
          {showForm && (
            <m.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onSubmit={handleSubmit}
              className="mt-8 space-y-6 overflow-hidden"
            >
              <TextField
                label="Adınız"
                name="reviewerName"
                autoComplete="name"
                error={errors.name}
              />
              <fieldset>
                <legend className="label text-olive">Puanınız</legend>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setFormRating(i + 1)}
                      aria-label={`${i + 1} yıldız`}
                      aria-pressed={formRating === i + 1}
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          i < formRating
                            ? "fill-brand text-brand"
                            : "fill-transparent text-ink/25"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </fieldset>
              <TextAreaField
                label="Düşünceleriniz"
                name="reviewText"
                rows={4}
                error={errors.text}
              />
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Gönderiliyor…" : "Gönder"}
              </Button>
            </m.form>
          )}
        </AnimatePresence>
      </div>

      {product.reviews.length === 0 ? (
        <p className="font-theme-display text-xl italic text-ink/55">
          Bu ürünün ilk değerlendirmesini siz yazın.
        </p>
      ) : (
        <ul className="border-t border-ink/10">
          {product.reviews.map((review, i) => (
            <li key={`${review.name}-${i}`} className="border-b border-ink/10 py-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Monogram name={review.name} />
                  <div>
                    <p className="text-sm text-ink">{review.name}</p>
                    <p className="mt-0.5 text-xs text-ink/45">{review.date}</p>
                  </div>
                </div>
                {review.verified && (
                  <span className="label whitespace-nowrap text-brand">
                    Doğrulanmış alıcı
                  </span>
                )}
              </div>
              <div className="mt-4">
                <Stars value={review.rating} className="h-3.5 w-3.5" />
              </div>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70">
                {review.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
