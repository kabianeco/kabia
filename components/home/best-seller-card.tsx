"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-context";
import { formatTL, type Product } from "@/lib/products";
import { routes } from "@/lib/site";

/**
 * Öne çıkanlar kartı: kapak, isim, ağırlık, fiyat ve stok durumuna göre
 * sepete ekle. Stok yoksa buton ölüdür ama kart ürün sayfasına gider —
 * satış kapalıyken bile fiyat ve hikaye görünür kalır.
 */
export function BestSellerCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const variant =
    product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const available = !!variant && variant.stock > 0;

  const handleAdd = async () => {
    if (!variant || !available) return;
    // The write must complete (or fail loudly) before the toast offers navigation.
    const accepted = await addItem({
      id: `${product.slug}__${variant.weight}`,
      slug: product.slug,
      name: product.name,
      variant: variant.weight,
      price: variant.price,
      image: product.mainImageUrl,
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
    toast.success(`Sepete eklendi — ${product.name}`, {
      action: {
        label: "Sepete git",
        onClick: () => router.push(routes.cart),
      },
    });
  };

  return (
    <li className="group flex flex-col">
      <Link href={routes.product(product.slug)} prefetch={false} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-theme-product-image bg-ivory">
          {product.mainImageUrl ? (
            <Image
              src={product.mainImageUrl}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="label text-olive">Fotoğraf hazırlanıyor</span>
            </div>
          )}
        </div>
        <div className="mt-5 border-t border-ink/10 pt-4">
          <h3 className="text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
            {product.name}
          </h3>
          {product.defaultWeight && (
            <p className="mt-1 text-sm text-ink/55">{product.defaultWeight}</p>
          )}
          <p className="figure mt-3 text-lg text-ink">
            {formatTL(product.price)}
          </p>
        </div>
      </Link>
      <div className="mt-4">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!available}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-theme-button border border-ink/20 px-5 text-sm transition-colors duration-300 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-ink/20 disabled:hover:text-ink"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {added ? "Sepette" : available ? "Sepete ekle" : "Stokta yok"}
        </button>
      </div>
    </li>
  );
}
