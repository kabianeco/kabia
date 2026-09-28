import type { ReactNode } from "react";
import Link from "next/link";
import { ProductEntry } from "@/components/shop/product-entry";
import {
  ProductDetailState,
  ProductGallery,
  ProductPriceLine,
  ProductPurchaseIsland,
  ProductRatingButton,
  ProductStickyBuyBar,
  ProductTabs,
} from "@/components/shop/product-detail-islands";
import { isPreviewItem } from "@/lib/preview-identity";
import {
  sourceBadgeLabel,
  CERTIFICATION_LABEL,
  isOrganicCertified,
  type Product,
} from "@/lib/products";
import { routes } from "@/lib/site";

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

/**
 * Where the product's longer story lives: the almond links to its own page
 * and the orchard guide; every product links to its storage answer and the
 * guide hub; producers' goods link to how their producers were chosen.
 */
function guideLinks(product: Product): { href: string; label: string }[] {
  return [
    ...(product.slug === "kabuklu-badem"
      ? [
          { href: "/badem", label: "Bademimizi tanıyın" },
          { href: routes.guide("geyve-badem-bahcesi"), label: "Geyve'de bir badem bahçesi" },
        ]
      : []),
    ...(product.source !== "ciftlik"
      ? [{ href: routes.guide("uretici-secimi"), label: "Üreticilerimizi nasıl seçiyoruz?" }]
      : []),
    { href: `${routes.guide("saklama")}#${product.slug}`, label: `${product.name} nasıl saklanır?` },
    { href: routes.guides, label: "Tüm rehberler" },
  ];
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

/**
 * The product page. Rendered on the server; the interactive parts — gallery,
 * rating link, price for the chosen weight, purchase panel, tabs, reviews and
 * the mobile buy bar — are client islands sharing one state
 * (product-detail-islands.tsx). Markup is unchanged from the single client
 * component it replaces.
 */
export function ProductDetail({
  product,
  related = [],
}: {
  product: Product;
  related?: Product[];
}) {
  const preview = isPreviewItem(product);

  return (
    <ProductDetailState product={product}>
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
        <ProductGallery />

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

          {product.reviewCount > 0 && <ProductRatingButton />}

          <ProductPriceLine />

          <p className="mt-6 text-base leading-relaxed text-ink/65">
            {product.shortDescription}
          </p>

          <ProductPurchaseIsland />

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
      <ProductTabs
        preview={preview}
        details={
          <div
            role="tabpanel"
            id="panel-detaylar"
            aria-labelledby="tab-detaylar"
            className="mt-10 grid gap-12 lg:grid-cols-2"
          >
            {/* Blank-line-separated paragraphs render as paragraphs, the
                producer-story convention; a one-paragraph description renders
                exactly as before. */}
            <div className="max-w-prose space-y-5">
              {product.description
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i} className="text-base leading-relaxed text-ink/70">
                    {paragraph}
                  </p>
                ))}
            </div>
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

              <div className="mt-8 border-t border-ink/10 pt-8">
                <p className="label text-olive">Rehber</p>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                  {guideLinks(product).map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        prefetch={false}
                        className="text-ink underline decoration-brand decoration-2 underline-offset-4"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

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
        }
        nutrition={
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
        }
      />

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
      <ProductStickyBuyBar />
    </div>
    </ProductDetailState>
  );
}
