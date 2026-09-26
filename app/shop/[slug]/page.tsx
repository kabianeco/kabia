import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { ProductDetail } from "@/components/shop/product-detail";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBrandPreview } from "@/lib/brand-preview";
import { isPreviewItem } from "@/lib/preview-identity";
import { previewProducts } from "@/content/preview-products";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/catalog";
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
      // Pinned to /teslimat-ve-iade §1 (handling same-day–3 business days,
      // transit 2–5 days domestic) and §3–5 (14-day withdrawal, food
      // exception, defective-goods rights). Rate mirrors the live
      // shipping_flat_rate (0); the threshold/rate copy on the legal pages
      // disagrees and is flagged for the owner in the maturity report.
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "TRY" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 3, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 5, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
      },
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

/** One catalogue read per request, shared by generateMetadata and the page. */
const getProduct = cache(async (slug: string) =>
  fetchProductBySlug(await createSupabaseServerClient(), slug),
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
    : isPreviewItem({ slug }) ? null : await getProduct(slug);
  if (!product) return { title: "Ürün bulunamadı" };
  const metadata = await pageMetadata({
    title: product.name,
    description: product.shortDescription || product.description,
    path: `/shop/${product.slug}`,
    keywords: [product.name, product.categoryName, "Kabia Ekolojik", "Geyve", "doğal ürün"],
    image: product.mainImageUrl ? { url: product.mainImageUrl, alt: product.name } : undefined,
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
  const product = await getProduct(slug);
  if (!product) notFound();
  const related = await fetchRelatedProducts(await createSupabaseServerClient(), product, 4);

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
