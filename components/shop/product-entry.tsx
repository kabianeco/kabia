import Image from "next/image";
import Link from "next/link";
import {
  CERTIFICATION_LABEL,
  formatTL,
  inStock,
  isOrganicCertified,
  sourceBadgeLabel,
  type Product,
} from "@/lib/products";
import { routes } from "@/lib/site";
import { STOCK_BADGE_STYLE } from "@/lib/theme-engine/stock-badge-style";

/**
 * One entry in the shop index. Deliberately not a card: no shadow, no radius,
 * no filled surface — the image sits on the page and a hairline carries the
 * metadata, the same way the homepage ledger presents a product.
 *
 * The image carries at most one badge ("Stokta yok"). The source
 * (Kabia Çiftliği / Seçki / Mutfak) lives in the metadata line under the
 * hairline instead, so a product that is both out of stock and sourced
 * never wears two overlapping labels.
 *
 * Hierarchy under the hairline is provenance → name → size → price →
 * availability. An asserted organic certification is stated as plain type
 * in the provenance area — never as a badge, never with a disclaimer.
 */
export function ProductEntry({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  // Lean rows (related products) carry no variants, so stock is unknown
  // there — an unknown state must read as nothing, never as "out of stock".
  const stockKnown = product.variants.length > 0;
  const available = !stockKnown || inStock(product);
  const outOfStock = stockKnown && !available;
  const organic = isOrganicCertified(product.certification);
  const discounted =
    product.originalPrice != null && product.originalPrice > product.price;

  return (
    <li className="group">
      <Link href={routes.product(product.slug)} prefetch={false} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-theme-product-image bg-paper">
          {product.mainImageUrl ? (
            <Image
              src={product.mainImageUrl}
              alt={product.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="label text-olive">Fotoğraf hazırlanıyor</span>
            </div>
          )}
          {outOfStock && (
            <span className="absolute px-3 py-1.5" style={STOCK_BADGE_STYLE}>
              <span className="label">Stokta yok</span>
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="label text-olive">{product.categoryName && <>{product.categoryName} • </>}{product.source === "ciftlik" || !product.producerName || product.producerName === product.name ? sourceBadgeLabel(product.source) : product.producerName}</p>
          {organic && (
            <p className="label mt-2 text-brand">{CERTIFICATION_LABEL[product.certification]}</p>
          )}
          <h2 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
            {product.name}
          </h2>
          {product.defaultWeight && (
            <p className="mt-1 text-sm text-ink/55">{product.defaultWeight}</p>
          )}
          <p className="mt-3 flex items-baseline gap-3">
            <span className="figure text-lg text-ink">
              {formatTL(product.price)}
            </span>
            {discounted && (
              <span className="figure text-sm text-olive line-through">
                {formatTL(product.originalPrice!)}
              </span>
            )}
          </p>
          {outOfStock && <p className="mt-2 label text-clay">Stokta yok</p>}
        </div>
      </Link>
    </li>
  );
}
