import Image from "next/image";
import Link from "next/link";
import { formatTL, inStock, type Product } from "@/lib/products";
import { routes } from "@/lib/site";
import { STOCK_BADGE_STYLE } from "@/lib/theme-engine/stock-badge-style";

/**
 * One entry in the shop index. Deliberately not a card: no shadow, no radius,
 * no filled surface — the image sits on the page and a hairline carries the
 * metadata, the same way the homepage ledger presents a product.
 */
export function ProductEntry({
 product,
 priority = false,
}: {
 product: Product;
 priority?: boolean;
}) {
 const available = inStock(product);
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
 {!available && (
 <span className="absolute px-3 py-1.5" style={STOCK_BADGE_STYLE}>
 <span className="label">Stokta yok</span>
 </span>
 )}
 </div>

  <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="label text-olive" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {product.slug === "kabuklu-badem" ? (
              <span style={{ fontSize: 10, letterSpacing: "0.07em", background: "white", color: "var(--primary-accent)", border: "1px solid var(--primary-accent)", padding: "3px 8px", borderRadius: 999, fontWeight: 700 }}>ORGANİK</span>
            ) : ["eriste", "tarhana", "domates-salcasi"].includes(product.slug) ? (
              <span style={{ fontSize: 9, letterSpacing: "0.06em", background: "var(--bg-accent-wash)", color: "var(--text-muted)", border: "1px solid var(--border-color)", padding: "2px 6px", borderRadius: 999 }}>GELENEKSEL</span>
            ) : (
              <span style={{ fontSize: 9, letterSpacing: "0.06em", background: "var(--bg-accent-wash)", color: "var(--text-muted)", border: "1px solid var(--border-color)", padding: "2px 6px", borderRadius: 999 }}>DOĞAL</span>
            )}
          </p>
 <h2 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
 {product.name}
 </h2>
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
 {!available && <p className="mt-2 label text-clay">Stokta yok</p>}
 </div>
 </Link>
 </li>
 );
}
