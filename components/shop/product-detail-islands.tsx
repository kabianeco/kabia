"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type AnimationEvent, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { Stars } from "@/components/shop/product-stars";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { isPreviewItem } from "@/lib/preview-identity";
import { formatTL, type Product } from "@/lib/products";
import { routes } from "@/lib/site";
import { isAllowedImageUrl } from "@/lib/shop-banner";
import { recordProductView } from "@/lib/recently-viewed";
import { STOCK_BADGE_STYLE } from "@/lib/theme-engine/stock-badge-style";
import { cn } from "@/lib/utils";

/**
 * The product page's client islands. The page itself (components/shop/
 * product-detail.tsx) renders on the server; these pieces share one small
 * state — selected weight, gallery image, open tab — through the provider
 * below, exactly as the single client component used to hold it.
 */

const TABS = [
  { id: "detaylar", label: "Ürün detayları" },
  { id: "beslenme", label: "Besin değerleri" },
  { id: "degerlendirmeler", label: "Değerlendirmeler" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ProductDetailStateValue {
  product: Product;
  galleryImages: string[];
  activeImage: number;
  setActiveImage: (i: number) => void;
  selectedVariant: string | undefined;
  setSelectedVariant: (weight: string) => void;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  reviewsRef: RefObject<HTMLDivElement | null>;
  showReviews: () => void;
  /** The image the cart line carries: the one on screen. */
  image: string;
}

const loadReviewsPanel = () => import("@/components/shop/product-reviews-panel");
const ReviewsPanel = dynamic(() => loadReviewsPanel().then((mod) => mod.ReviewsPanel));

const ProductDetailStateContext = createContext<ProductDetailStateValue | null>(null);

function useProductDetailState(): ProductDetailStateValue {
  const ctx = useContext(ProductDetailStateContext);
  if (!ctx) throw new Error("Product islands must render inside ProductDetailState");
  return ctx;
}

function selectedVariantOf(product: Product, selectedWeight: string | undefined) {
  return product.variants.find((v) => v.weight === selectedWeight) ?? product.variants[0];
}

export function ProductDetailState({ product, children }: { product: Product; children: ReactNode }) {
  const reviewsRef = useRef<HTMLDivElement>(null);

  const galleryImages = useMemo(
    // S24: implausible URLs never reach next/image (thumbs render only from
    // this list; the main image keeps its own gate below).
    () => (product.images.length ? product.images : [product.mainImageUrl]).filter(isAllowedImageUrl),
    [product.images, product.mainImageUrl],
  );
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(product.defaultWeight);
  const [activeTab, setActiveTab] = useState<TabId>("detaylar");

  // Feeds the "recently viewed" row on the account overview.
  useEffect(() => {
    recordProductView(product.slug);
  }, [product.slug]);

  const image = galleryImages[activeImage] ?? product.mainImageUrl;

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

  const value: ProductDetailStateValue = {
    product,
    galleryImages,
    activeImage,
    setActiveImage,
    selectedVariant,
    setSelectedVariant,
    activeTab,
    setActiveTab,
    reviewsRef,
    showReviews,
    image,
  };
  return <ProductDetailStateContext.Provider value={value}>{children}</ProductDetailStateContext.Provider>;
}

/** Gallery column: the main image (animated on change) and the thumbnails. */
export function ProductGallery() {
  const { product, galleryImages, activeImage, setActiveImage, selectedVariant } = useProductDetailState();
  const variant = selectedVariantOf(product, selectedVariant);
  const available = !!variant && variant.stock > 0;
  // An image swap fades the old one out, then the new one in (250 ms each,
  // CSS .gallery-fade-*); the first paint is immediate.
  const [shown, setShown] = useState(activeImage);
  const [fade, setFade] = useState<"idle" | "out" | "in">("idle");
  if (activeImage !== shown && fade === "idle") setFade("out");
  const image = galleryImages[shown] ?? product.mainImageUrl;
  const onFadeEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (fade === "out") {
      setShown(activeImage);
      setFade("in");
    } else if (fade === "in") {
      setFade("idle");
    }
  };
  return (
    <>
        <div className="md:col-span-1 lg:col-span-6">
          <div className="relative aspect-[4/5] overflow-hidden rounded-theme-product-image bg-paper">
            {/* §5.4: the first paint renders immediately (no hydration fade);
                later image transitions keep their animation. */}
            <div
              key={shown}
              className={cn(
                "absolute inset-0",
                fade === "out" && "gallery-fade-out",
                fade === "in" && "gallery-fade-in",
              )}
              onAnimationEnd={onFadeEnd}
            >
                {/* S24: an implausible URL degrades to the paper backdrop
                    instead of throwing out of next/image. */}
                {isAllowedImageUrl(image) ? (
                <Image
                  src={image}
                  alt={product.name}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
                ) : null}
            </div>
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

    </>
  );
}

/** The rating summary under the title; opens the reviews tab. */
export function ProductRatingButton() {
  const { product, showReviews } = useProductDetailState();
  return (
    <>
            <button
              type="button"
              onClick={showReviews}
              onPointerEnter={() => void loadReviewsPanel()}
              onFocus={() => void loadReviewsPanel()}
              className="mt-4 flex min-h-11 items-center gap-3 text-sm text-ink/60 transition-colors hover:text-ink"
            >
              <Stars value={product.rating} />
              <span>
                {product.rating.toFixed(1)} · {product.reviewCount} değerlendirme
              </span>
            </button>
    </>
  );
}

/** Price and the size · availability line for the selected weight. */
export function ProductPriceLine() {
  const { product, selectedVariant } = useProductDetailState();
  const variant = selectedVariantOf(product, selectedVariant);
  const available = !!variant && variant.stock > 0;
  const discounted =
    product.originalPrice != null && product.originalPrice > (variant?.price ?? 0);
  return (
    <>
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

    </>
  );
}

/** The purchase panel, bound to the shared weight and image. */
export function ProductPurchaseIsland() {
  const { product, image, selectedVariant, setSelectedVariant } = useProductDetailState();
  return <ProductPurchase product={product} image={image} selectedWeight={selectedVariant} onWeightChange={setSelectedVariant} />;
}

/**
 * Tab bar and panels. The detail and nutrition panels arrive rendered from the
 * server; only which one is shown is decided here.
 */
export function ProductTabs({
  preview,
  details,
  nutrition,
}: {
  preview: boolean;
  details: ReactNode;
  nutrition: ReactNode;
}) {
  const { product, activeTab, setActiveTab, reviewsRef } = useProductDetailState();
  // The reviews panel is its own chunk: fetch it once the tabs come within a
  // screen of the viewport, so it is usually ready before anyone opens it.
  useEffect(() => {
    const el = reviewsRef.current;
    if (preview || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadReviewsPanel();
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [preview, reviewsRef]);
  return (
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
                  onPointerEnter={tab.id === "degerlendirmeler" ? () => void loadReviewsPanel() : undefined}
                  onFocus={tab.id === "degerlendirmeler" ? () => void loadReviewsPanel() : undefined}
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

        {activeTab === "detaylar" && details}

        {!preview && activeTab === "beslenme" && nutrition}

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
  );
}

/** Mobile sticky buy bar, bound to the shared weight and image. */
export function ProductStickyBuyBar() {
  const { product, image, selectedVariant } = useProductDetailState();
  return <StickyBuyBar product={product} image={image} selectedWeight={selectedVariant} />;
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
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const preview = isPreviewItem(product);
  const variant =
    product.variants.find((v) => v.weight === (selectedWeight ?? product.defaultWeight)) ??
    product.variants[0];
  const available = !!variant && variant.stock > 0;
  const blocked = !available || !cartHydrated || (preview && (!authHydrated || !!userId));

  const handleAdd = async () => {
    if (!variant || !available) return;
    // The write must complete (or fail loudly) before the toast offers navigation.
    const accepted = await addItem({
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
    if (!accepted) {
      toast.error("Sepete eklenemedi. Lütfen tekrar deneyin.");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    toast.success(`Sepete eklendi — ${product.name}, ${variant.weight}`, {
      action: { label: "Sepete git", onClick: () => router.push(routes.cart) },
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
