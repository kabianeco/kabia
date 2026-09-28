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
 * Product + Offer (+ AggregateRating when reviewed) + BreadcrumbList.
 * Only real catalogue rows get schema — preview items never do.
 */
function productJsonLd(product: Product) {
  const defaultVariant =
    product.variants.find((v) => v.weight === product.defaultWeight) ?? product.variants[0];
  const inStock = product.variants.some((v) => v.stock > 0);
  const accountReviews = product.reviews.filter((review) => review.accountBacked);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    // Structured data does not resolve relative paths.
    image: product.images.length > 0 ? product.images.map(absoluteUrl) : undefined,
    brand: { "@type": "Brand", name: "Kabia Ekolojik" },
    offers: {
      "@type": "Offer",
      url: `${site.url}/shop/${product.slug}`,
      priceCurrency: "TRY",
      price: defaultVariant?.price ?? product.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Kabia Ekolojik" },
      // No shippingDetails / hasMerchantReturnPolicy: the site states three
      // shipping fees (legal 29,90 ₺; product/FAQ/cart 107,91 ₺; live setting
      // 0) and two return windows (14 / 15 days). Structured data may only
      // state what is true; restored once the owner confirms the terms.
    },
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
  if (!product) return { title: "Ürün bulunamadı", robots: { index: false, follow: false } };
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
  const product = { ...base, reviews };

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
