"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField, TextAreaField } from "@/components/ui/field";
import { ProductEntry } from "@/components/shop/product-entry";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { isPreviewItem } from "@/lib/preview-identity";
import {
  formatTL,
  sourceBadgeLabel,
  CERTIFICATION_LABEL,
  isOrganicCertified,
  type Product,
} from "@/lib/products";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { routes } from "@/lib/site";
import { recordProductView } from "@/lib/recently-viewed";
import { EASE } from "@/lib/motion";
import { STOCK_BADGE_STYLE } from "@/lib/theme-engine/stock-badge-style";

/**
 * Tek tip: tüm ürünlerde aynı iki satır. Üretici ayrımı hikaye
 * kartlarında ve menşei satırında yaşar; garanti kutusu marka sözüdür.
 */
function guarantees(_product: Product) {
  return [
    // Kargo ücreti lib/cart-context SHIPPING_COST ile aynı olmalı (şu an 107,91₺ HepsiJet).
    { label: "Ücretsiz kargo", detail: "2000₺ üzeri ücretsiz, altı ₺107,91" },
    { label: "15 gün iade", detail: "Açılmamış ürünlerde" },
    { label: "Tek kaynak", detail: "Kabia Ekolojik" },
    { label: "Katkısız", detail: "Koruyucu ve katkı maddesi içermez" },
  ];
}

/**
 * Certification rendering is legal-critical (brief §7.2/§9): only
 * 'organik_sertifikali' may ever be described as organic. 'kabia_secki' and
 * 'kabia_mutfak' are Kabia's own selection standard — stated in those words,
 * never with the organic vocabulary — and link to /kabia-standardi where the
 * distinction is explained (Appendix A.8). An asserted organic certification
 * stands alone up in the purchase area; this row never qualifies it.
 */
function certificationRow(product: Product): ReactNode {
  // Ürüne özel sertifika metni (3000 dili) önde: "Sertifikasız — organik
  // sertifikası bulunmamaktadır. Doğal üretim, ..." — boşsa standart etiket.
  if (product.certificates) {
    return product.certificates;
  }
  if (isOrganicCertified(product.certification)) {
    return CERTIFICATION_LABEL[product.certification];
  }
  return (
    <span>
      {CERTIFICATION_LABEL[product.certification]} — Kabia&rsquo;nın kendi
      seçim standardı.
    </span>
  );
}

function producerRow(product: Product): ReactNode {
  if (!product.producerName) return "";
  if (!product.producerSlug) return product.producerName;
  return (
    <Link
      href={`${routes.producers}/${product.producerSlug}`}
      prefetch={false}
      className="underline decoration-brand decoration-2 underline-offset-4"
    >
      {product.producerName}
    </Link>
  );
}

/**
 * Row order adapts to source (brief §9): Mutfak products foreground
 * allergens/net weight, since farm-specific fields (variety, rootstock,
 * harvest year) don't apply to them and are filtered out as empty anyway.
 */
function productDetailRows(product: Product): [string, ReactNode][] {
  if (isPreviewItem(product)) return [["Üretici", producerRow(product)]];
  const identity: [string, ReactNode][] = [
    ["Üretici", producerRow(product)],
    ["Menşei", product.origin],
    ["Çeşit", product.variety],
    ["Anaç", product.rootstock],
    ["Hasat yılı", product.harvestYear ? String(product.harvestYear) : ""],
    ["Lot kodu", product.lotCode],
  ];
  const production: [string, ReactNode][] = [
    ["Üretim yöntemi", product.productionMethod],
    ["İşleme", product.processing],
  ];
  const keeping: [string, ReactNode][] = [
    ["Raf ömrü", product.shelfLife],
    ["Saklama", product.storage],
  ];
  const foodInfo: [string, ReactNode][] = [
    ["Alerjenler", product.allergens],
    ["Net ağırlık", product.netWeight],
  ];
  // Tek satır: serbest-metin "Sertifikalar" satırı enum satırını tekrar
  // ediyordu (Sertifikalar/Sertifika yan yana kafa karıştırıyordu).
  // Ürüne özel notlar description/productionMethod içinde zaten yaşıyor.
  const certs: [string, ReactNode][] = [
    ["Sertifika", certificationRow(product)],
  ];
  return product.source === "mutfak"
    ? [...identity, ...foodInfo, ...production, ...keeping, ...certs]
    : [...identity, ...production, ...keeping, ...foodInfo, ...certs];
}

const TABS = [
  { id: "detaylar", label: "Ürün detayları" },
  { id: "beslenme", label: "Besin değerleri" },
  { id: "degerlendirmeler", label: "Değerlendirmeler" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="flex" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${className} ${
            i < Math.round(value)
              ? "fill-brand text-brand"
              : "fill-transparent text-ink/25"
          }`}
        />
      ))}
    </span>
  );
}

/** Initials stand in for reviewer avatars — no third-party image host. */
function Monogram({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 font-serif text-sm text-olive"
    >
      {initials || "K"}
    </span>
  );
}

export function ProductDetail({
  product,
  related = [],
}: {
  product: Product;
  related?: Product[];
}) {
  const preview = isPreviewItem(product);
  const reviewsRef = useRef<HTMLDivElement>(null);

  const galleryImages = useMemo(
    () => (product.images.length ? product.images : [product.mainImageUrl]),
    [product.images, product.mainImageUrl],
  );
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(product.defaultWeight);
  const [activeTab, setActiveTab] = useState<TabId>("detaylar");

  // Feeds the "recently viewed" row on the account overview.
  useEffect(() => {
    recordProductView(product.slug);
  }, [product.slug]);

  const variant =
    product.variants.find((v) => v.weight === selectedVariant) ??
    product.variants[0];
  const image = galleryImages[activeImage] ?? product.mainImageUrl;
  const available = !!variant && variant.stock > 0;
  const discounted =
    product.originalPrice != null && product.originalPrice > (variant?.price ?? 0);

  const showReviews = () => {
    setActiveTab("degerlendirmeler");
    setTimeout(
      () =>
        reviewsRef.current?.scrollIntoView({
          // An explicit "smooth" overrides the stylesheet's reduced-motion rule.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        }),
      50,
    );
  };


  return (
    <div className="wrap page-top pb-24 md:pb-32">
      <nav aria-label="Site haritası" className="text-sm text-ink/50">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={routes.home} className="transition-colors hover:text-ink">
              Anasayfa
            </Link>
          </li>
          <li aria-hidden="true">·</li>
          <li>
              <Link href={routes.store} className="transition-colors hover:text-ink">
                Mağaza
              </Link>
          </li>
          <li aria-hidden="true">·</li>
          <li className="text-ink/80">{product.name}</li>
        </ol>
      </nav>

      {/* Tablet reads side-by-side rather than stacked: at md the gallery
          no longer owns the whole first viewport and the title, price and
          purchase controls enter the decision area with it. */}
      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-8 lg:grid-cols-12 lg:gap-16">
        {/* Gallery */}
        <div className="md:col-span-1 lg:col-span-6">
          <div className="relative aspect-[4/5] overflow-hidden rounded-theme-product-image bg-paper">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="absolute inset-0"
              >
                <Image
                  src={image}
                  alt={product.name}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
            {!available && (
              <span className="absolute px-4 py-2" style={STOCK_BADGE_STYLE}>
                <span className="label">Stokta yok</span>
              </span>
            )}
          </div>

          {galleryImages.length > 1 && (
            <ul className="mt-3 grid grid-cols-4 gap-3">
              {galleryImages.map((src, i) => (
                <li key={src}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`${product.name} — görsel ${i + 1}`}
                    aria-current={activeImage === i ? "true" : undefined}
                    className={`relative block aspect-square w-full overflow-hidden rounded-theme-product-image border transition-colors duration-300 ${
                      activeImage === i
                        ? "border-brand"
                        : "border-ink/10 hover:border-ink/30"
                    }`}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="120px"
                      className="object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Info */}
        <div className="md:col-span-1 lg:col-span-5 lg:col-start-8">
          {/* Same text nodes as before the category rename, so the line shapes
              identically; an unreadable category drops its segment. */}
          <p className="label text-olive">{product.categoryName && <>{product.categoryName} • </>}{sourceBadgeLabel(product.source)}</p>
          {isOrganicCertified(product.certification) && (
            <p className="label mt-2 text-brand">{CERTIFICATION_LABEL[product.certification]}</p>
          )}
          <h1 className="mt-4 text-3xl leading-[1.1] tracking-tight md:text-4xl">
            {product.name}
          </h1>

          {product.reviewCount > 0 && (
            <button
              type="button"
              onClick={showReviews}
              className="mt-4 flex min-h-11 items-center gap-3 text-sm text-ink/60 transition-colors hover:text-ink"
            >
              <Stars value={product.rating} />
              <span>
                {product.rating.toFixed(1)} · {product.reviewCount} değerlendirme
              </span>
            </button>
          )}

          <p className="mt-6 flex items-baseline gap-4">
            <span className="figure text-3xl text-ink">
              {variant ? formatTL(variant.price) : "—"}
            </span>
            {discounted && (
              <span className="figure text-base text-olive line-through">
                {formatTL(product.originalPrice!)}
              </span>
            )}
          </p>

          {/* Size and availability read as one quiet line directly under the
              price, so the eye meets provenance → name → size → price →
              availability in that order. */}
          {variant && (
            <p className={`mt-2 text-sm ${available ? "text-ink/55" : "text-clay"}`}>
              {variant.weight}
              <span aria-hidden="true" className="mx-2">·</span>
              {available ? "Stokta" : "Stokta yok"}
            </p>
          )}

          <p className="mt-6 text-base leading-relaxed text-ink/65">
            {product.shortDescription}
          </p>

          <ProductPurchase product={product} image={image} selectedWeight={selectedVariant} onWeightChange={setSelectedVariant} />

          {!preview && <dl className="mt-12 grid grid-cols-2 border-t border-ink/10">
            {guarantees(product).map((g) => (
              <div key={g.label} className="border-b border-ink/10 py-4 pr-4">
                <dt className="text-sm text-ink">{g.label}</dt>
                <dd className="mt-1 text-xs text-ink/50">{g.detail}</dd>
              </div>
            ))}
          </dl>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-20 md:mt-28" ref={reviewsRef}>
        <div className="border-b border-ink/10">
          <div role="tablist" aria-label="Ürün bilgileri" className="flex flex-wrap gap-8">
            {(preview ? TABS.slice(0, 1) : TABS).map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px min-h-12 border-b-2 text-sm transition-colors duration-300 ${
                    active
                      ? "border-brand text-ink"
                      : "border-transparent text-ink/50 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "detaylar" && (
          <div
            role="tabpanel"
            id="panel-detaylar"
            aria-labelledby="tab-detaylar"
            className="mt-10 grid gap-12 lg:grid-cols-2"
          >
            <p className="max-w-prose text-base leading-relaxed text-ink/70">
              {product.description}
            </p>
            <div>
              <dl className="border-t border-ink/10">
                {productDetailRows(product)
                  .filter(([, value]) => !!value)
                  .map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-1 gap-1 border-b border-ink/10 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
              >
                      <dt className="label text-olive">{label}</dt>
                      <dd className="text-sm text-ink/70">{value}</dd>
                    </div>
                  ))}
              </dl>

              {product.source === "secki" && product.producerWhySelected && (
                <div className="mt-8 border-t border-ink/10 pt-8">
                  <p className="label text-olive">Neden bu üreticiyi seçtik?</p>
                  <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/70">
                    {product.producerWhySelected}
                  </p>
                  {product.producerSlug && (
                    <Link
                      href={`${routes.producers}/${product.producerSlug}`}
                      prefetch={false}
                      className="mt-4 inline-block text-sm text-ink underline decoration-brand decoration-2 underline-offset-4"
                    >
                      Üreticiyi tanıyın
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!preview && activeTab === "beslenme" && (
          <div role="tabpanel" id="panel-beslenme" aria-labelledby="tab-beslenme" className="mt-10">
            <p className="text-sm text-ink/55">
              100 g ürün için yaklaşık besin değerleri
            </p>
            <dl className="mt-6 max-w-lg border-t border-ink/10">
              {(
                [
                  ["Kalori", product.nutrition.kalori],
                  ["Protein", product.nutrition.protein],
                  ["Karbonhidrat", product.nutrition.karbonhidrat],
                  ["Yağ", product.nutrition.yag],
                  ["Lif", product.nutrition.lif],
                  ["Sodyum", product.nutrition.sodyum],
                ] as const
              )
                .filter(([, value]) => !!value)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between border-b border-ink/10 py-3.5"
                  >
                    <dt className="text-sm text-ink/70">{label}</dt>
                    <dd className="figure text-sm text-ink">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}

        {!preview && activeTab === "degerlendirmeler" && (
          <div
            role="tabpanel"
            id="panel-degerlendirmeler"
            aria-labelledby="tab-degerlendirmeler"
            className="mt-10"
          >
            <ReviewsPanel product={product} />
          </div>
        )}
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-24 md:mt-32">
          <h2
            id="related-heading"
            className="border-t border-ink/10 pt-10 text-2xl tracking-tight"
          >
            Benzer ürünler
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductEntry key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}

      {/* Mobile sticky buy bar (below md only) + spacer so the footer
          stays reachable above it. Same gating as the in-flow panel. */}
      <StickyBuyBar product={product} image={image} selectedWeight={selectedVariant} />
    </div>
  );
}

/**
 * Mobile-only sticky buy bar: name + live price + add-to-cart.
 * Mirrors ProductPurchase gating (hydration, preview, stock) so the two
 * can never disagree about whether buying is possible.
 */
function StickyBuyBar({
  product,
  image,
  selectedWeight,
}: {
  product: Product;
  image: string;
  selectedWeight?: string;
}) {
  const { addItem, hydrated: cartHydrated } = useCart();
  const { userId, hydrated: authHydrated } = useAuth();
  const [added, setAdded] = useState(false);
  const preview = isPreviewItem(product);
  const variant =
    product.variants.find((v) => v.weight === (selectedWeight ?? product.defaultWeight)) ??
    product.variants[0];
  const available = !!variant && variant.stock > 0;
  const blocked = !available || !cartHydrated || (preview && (!authHydrated || !!userId));

  const handleAdd = () => {
    if (!variant || !available) return;
    const accepted = addItem({
      id: `${product.slug}__${variant.weight}`,
      slug: product.slug,
      name: product.name,
      variant: variant.weight,
      price: variant.price,
      image,
      quantity: 1,
      variantId: variant.id,
      productId: product.id,
    });
    if (!accepted) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    toast.success(`Sepete eklendi — ${product.name}, ${variant.weight}`, {
      action: { label: "Sepete git", onClick: () => (window.location.href = routes.cart) },
    });
  };

  return (
    <>
      <div aria-hidden="true" className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 backdrop-blur-sm md:hidden">
        <div
          className="flex items-center gap-3 px-4 pt-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{product.name}</p>
            <p className="figure mt-0.5 text-base text-ink">
              {variant ? formatTL(variant.price) : "—"}
            </p>
          </div>
          <Button onClick={handleAdd} disabled={blocked} size="lg" className="shrink-0">
            {added ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Eklendi
              </>
            ) : available ? (
              <>
                <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Sepete ekle
              </>
            ) : (
              "Stokta yok"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function ReviewsPanel({ product }: { product: Product }) {
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
    const supabase = createSupabaseBrowserClient();
    const { data: udata } = await supabase.auth.getUser();
    if (!udata.user) {
      setSubmitting(false);
      toast.error("Değerlendirme yazmak için giriş yapın.");
      return;
    }
    const { error } = await supabase.from("reviews").insert({
      product_id: product.id,
      user_id: udata.user.id,
      reviewer_name: reviewerName,
      rating: formRating,
      review_text: reviewText,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Değerlendirme kaydedilemedi. Lütfen tekrar deneyin.");
      return;
    }
    toast.success("Değerlendirmeniz için teşekkürler.");
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
                  <motion.span
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
            <motion.form
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
            </motion.form>
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
