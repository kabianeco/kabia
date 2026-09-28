import Image from "next/image";
import Link from "next/link";
import { BestSellerAdd } from "@/components/home/best-seller-add";
import { formatTL, type Product } from "@/lib/products";
import { routes } from "@/lib/site";

/**
 * Öne çıkanlar kartı: kapak, isim, ağırlık, fiyat ve stok durumuna göre
 * sepete ekle. Stok yoksa buton ölüdür ama kart ürün sayfasına gider —
 * satış kapalıyken bile fiyat ve hikaye görünür kalır.
 *
 * Sunucuda render edilir; yalnızca sepete ekle düğmesi istemci adasıdır
 * (BestSellerAdd) ve ürünün tamamı yerine eklenecek satırı alır.
 */
export function BestSellerCard({ product }: { product: Product }) {
  const variant =
    product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const available = !!variant && variant.stock > 0;

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
        <BestSellerAdd
          line={
            variant && available
              ? {
                  id: `${product.slug}__${variant.weight}`,
                  slug: product.slug,
                  name: product.name,
                  variant: variant.weight,
                  price: variant.price,
                  image: product.mainImageUrl,
                  variantId: variant.id,
                  productId: product.id,
                }
              : null
          }
        />
      </div>
    </li>
  );
}
