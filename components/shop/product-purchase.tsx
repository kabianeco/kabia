"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites-context";
import { isPreviewItem, PREVIEW_GUEST_MESSAGE } from "@/lib/preview-identity";
import { routes } from "@/lib/site";
import type { Product } from "@/lib/products";

/** Weight, quantity and purchase controls extracted from ProductDetail. */
export function ProductPurchase({ product, image = product.mainImageUrl, selectedWeight, onWeightChange }: {
  product: Product; image?: string; selectedWeight?: string; onWeightChange?: (weight: string) => void;
}) {
  const { addItem, hydrated: cartHydrated } = useCart();
  const { userId, hydrated: authHydrated } = useAuth();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const quantityId = useId();
  const [weight, setWeight] = useState(product.defaultWeight);
  const selectedVariant = selectedWeight ?? weight;
  const setSelectedVariant = (value: string) => { setWeight(value); onWeightChange?.(value); };
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const preview = isPreviewItem(product);
  const favorited = isFavorite(product.slug);
  const variant = product.variants.find((v) => v.weight === selectedVariant) ?? product.variants[0];
  const available = !!variant && variant.stock > 0;
  const handleAddToCart = async () => {
    if (!variant || !available) return;
    // The write must complete (or fail loudly) before the toast offers navigation.
    const accepted = await addItem({
      id: `${product.slug}__${variant.weight}`,
      slug: product.slug,
      name: product.name,
      variant: variant.weight,
      price: variant.price,
      image,
      quantity,
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

  return <>
          {product.variants.length > 0 && (
            <fieldset className="mt-10">
              <legend className="label text-olive">Ağırlık</legend>
              <div className="mt-4 flex flex-wrap gap-3">
                {product.variants.map((v) => {
                  const active = v.weight === selectedVariant;
                  const sold = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={sold}
                      onClick={() => setSelectedVariant(v.weight)}
                      aria-pressed={active}
                      className={`min-h-11 rounded-theme-button border px-5 text-sm transition-colors duration-300 ${
                        active
                          ? "border-brand bg-brand text-on-brand"
                          : "border-ink/20 text-ink hover:border-brand hover:text-brand"
                      } ${sold ? "cursor-not-allowed line-through opacity-45 hover:border-ink/20 hover:text-ink" : ""}`}
                    >
                      {v.weight}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-8">
            <p className="label text-olive" id={quantityId}>
              Adet
            </p>
            <div
              className="mt-4 inline-flex items-center border border-ink/20"
              role="group"
              aria-labelledby={quantityId}
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="flex h-12 w-12 items-center justify-center text-ink transition-colors hover:text-brand disabled:opacity-35"
                aria-label="Adedi azalt"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <output className="figure w-12 text-center text-base" aria-live="polite">
                {quantity}
              </output>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                disabled={quantity >= 99}
                className="flex h-12 w-12 items-center justify-center text-ink transition-colors hover:text-brand disabled:opacity-35"
                aria-label="Adedi artır"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleAddToCart}
              disabled={!available || !cartHydrated || (preview && (!authHydrated || !!userId))}
              className="flex-1"
              size="lg"
            >
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
            {!preview && <Button
              variant="outline"
              size="lg"
              onClick={() => toggleFavorite(product.slug)}
              aria-pressed={favorited}
            >
              <Heart
                className={`h-4 w-4 transition-colors ${favorited ? "fill-brand text-brand" : ""}`}
                aria-hidden="true"
              />
              {favorited ? "Favorilerde" : "Favorilere ekle"}
            </Button>}
          </div>

    {preview && userId && <p role="status" className="mt-4 text-sm text-clay">{PREVIEW_GUEST_MESSAGE}</p>}
  </>;
}
