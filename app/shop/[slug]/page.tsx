import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { ProductDetail } from "@/components/shop/product-detail";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBrandPreview } from "@/lib/brand-preview";
import { isPreviewItem } from "@/lib/preview-identity";
import { previewProducts } from "@/content/preview-products";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/catalog";
import { site } from "@/lib/site";
import type { Product } from "@/lib/products";

/**
 * Product + Offer (+ AggregateRating when reviewed) + BreadcrumbList.
 * Only real catalogue rows get schema — preview items never do.
 */
function productJsonLd(product: Product) {
  const defaultVariant =
    product.variants.find((v) => v.weight === product.defaultWeight) ?? product.variants[0];
  const inStock = product.variants.some((v) => v.stock > 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    image: product.images.length > 0 ? product.images : undefined,
    brand: { "@type": "Brand", name: "Kabia Ekolojik" },
    offers: {
      "@type": "Offer",
      url: `${site.url}/shop/${product.slug}`,
      priceCurrency: "TRY",
      price: defaultVariant?.price ?? product.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Kabia Ekolojik" },
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const preview = isBrandPreview();
  const product = preview
    ? previewProducts.find((product) => product.slug === slug)
    : isPreviewItem({ slug }) ? null : await fetchProductBySlug(await createSupabaseServerClient(), slug);
  if (!product) return { title: "Ürün bulunamadı" };
  return {
    robots: preview ? { index: false, follow: false } : undefined,
    title: product.name,
    description: product.shortDescription,
    keywords: [product.name, product.categoryName, "Kabia Ekolojik", "Geyve", "doğal ürün"],
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: product.mainImageUrl
      ? {
          title: product.name,
          description: product.shortDescription,
          images: [{ url: product.mainImageUrl, alt: product.name }],
        }
      : undefined,
  };
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
  const supabase = await createSupabaseServerClient();
  const product = await fetchProductBySlug(supabase, slug);
  if (!product) notFound();
  const related = await fetchRelatedProducts(supabase, product, 4);

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
