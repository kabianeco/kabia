import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { ProductDetail } from "@/components/shop/product-detail";
import { isBrandPreview } from "@/lib/brand-preview";
import { isPreviewItem } from "@/lib/preview-identity";
import { previewProducts } from "@/content/preview-products";
import { getCachedProductBase, getCachedProductReviews, getCachedRelatedProducts } from "@/lib/catalog";
import { site } from "@/lib/site";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import type { Product } from "@/lib/products";

/**
 * Product structured data. One size → Product + Offer. Several sizes →
 * ProductGroup whose hasVariant lists one Product per size, each with its own
 * price and its own availability — a single Offer used to pair the default
 * size's price with "in stock" even when that size had sold out and only
 * another one was left. AggregateRating only from account-backed reviews.
 * Only real catalogue rows get schema — preview items never do.
 */
function productJsonLd(product: Product) {
  const url = `${site.url}/shop/${product.slug}`;
  // Structured data does not resolve relative paths.
  const image = product.images.length > 0 ? product.images.map(absoluteUrl) : undefined;
  const offer = (price: number, available: boolean) => ({
    "@type": "Offer",
    url,
    priceCurrency: "TRY",
    price,
    availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    seller: { "@type": "Organization", name: site.name },
    // No shippingDetails / hasMerchantReturnPolicy: the site states three
    // shipping fees (legal 29,90 ₺; product/FAQ/cart 107,91 ₺; live setting
    // 0) and two return windows (14 / 15 days). Structured data may only
    // state what is true; restored once the owner confirms the terms.
  });
  const accountReviews = product.reviews.filter((review) => review.accountBacked);
  const common = {
    "@context": "https://schema.org",
    name: product.name,
    description: product.shortDescription || product.description,
    image,
    // Kabia's own label only on the farm's own produce: a producer's walnuts
    // or honey are not a Kabia Ekolojik brand product, and the site names the
    // producer, not a brand, for them.
    ...(product.source === "ciftlik" ? { brand: { "@type": "Brand", name: site.name } } : {}),
    // Only reviews written through a real account count.
    ...(accountReviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(
              (accountReviews.reduce((sum, r) => sum + r.rating, 0) / accountReviews.length).toFixed(1),
            ),
            reviewCount: accountReviews.length,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  if (product.variants.length <= 1) {
    const only = product.variants[0];
    return {
      ...common,
      "@type": "Product",
      ...(only ? { sku: only.id } : {}),
      offers: offer(only?.price ?? product.price, (only?.stock ?? 0) > 0),
    };
  }

  return {
    ...common,
    "@type": "ProductGroup",
    url,
    productGroupID: product.id,
    variesBy: ["https://schema.org/size"],
    hasVariant: product.variants.map((variant) => ({
      "@type": "Product",
      name: `${product.name} ${variant.weight}`,
      sku: variant.id,
      size: variant.weight,
      image,
      offers: offer(variant.price, variant.stock > 0),
    })),
  };
}

function breadcrumbJsonLd(product: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana sayfa", item: site.url },
      { "@type": "ListItem", position: 2, name: "Mağaza", item: `${site.url}/magaza` },
      { "@type": "ListItem", position: 3, name: product.name, item: `${site.url}/shop/${product.slug}` },
    ],
  };
}

/** One catalogue read per request, shared by generateMetadata and the page. Metadata needs no reviews. */
const getProductBase = cache(async (slug: string) =>
  getCachedProductBase(slug),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const preview = isBrandPreview();
  const product = preview
    ? previewProducts.find((product) => product.slug === slug)
    : isPreviewItem({ slug }) ? null : await getProductBase(slug);
  if (!product) return { title: "Sayfa bulunamadı", robots: { index: false, follow: false } };
  // Administered SEO copy wins when present; otherwise name + short, as before.
  const metadata = await pageMetadata({
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription || product.description,
    path: `/shop/${product.slug}`,
    keywords: [product.name, product.categoryName, "Kabia Ekolojik", "Geyve", "doğal ürün"],
    // No image here: app/shop/[slug]/opengraph-image.tsx serves the single
    // branded 1200×630 card (real photo embedded), so scrapers see one image.
    skipImage: true,
  });
  return preview ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ boyut?: string | string[] }>;
}) {
  const [{ slug }, { boyut }] = await Promise.all([params, searchParams]);
  if (isBrandPreview()) {
    const product = previewProducts.find((product) => product.slug === slug);
    if (!product) notFound();
    const related = previewProducts.filter((other) => other.id !== product.id && other.source === product.source).slice(0, 4);
    return <PageShell><ProductDetail product={product} related={related} /></PageShell>;
  }
  if (isPreviewItem({ slug })) notFound();
  const base = await getProductBase(slug);
  if (!base) notFound();
  // Reviews and related ride the same cache tag (busted on review submits,
  // catalog mutations and order commits): warm, all three read in parallel.
  const [reviews, related] = await Promise.all([
    getCachedProductReviews(base.id),
    getCachedRelatedProducts(base.category, base.slug, 4),
  ]);
  // ?boyut=<size> opens the page on that size — the link each size's item in
  // the Merchant feed carries, so the landing page shows the price the feed
  // states. Anything else opens on the default size, as before. The canonical
  // stays the bare product URL.
  const requested = typeof boyut === "string" ? base.variants.find((v) => v.weight === boyut) : undefined;
  const product = { ...base, reviews, ...(requested ? { defaultWeight: requested.weight } : {}) };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(product)) }}
      />
      <ProductDetail product={product} related={related} />
    </PageShell>
  );
}
