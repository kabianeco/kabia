import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { ProductDetail } from "@/components/shop/product-detail";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const product = await fetchProductBySlug(supabase, slug);
  if (!product) return { title: "Ürün bulunamadı" };
  return {
    title: product.name,
    description: product.shortDescription,
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
  const supabase = await createSupabaseServerClient();
  const product = await fetchProductBySlug(supabase, slug);
  if (!product) notFound();
  const related = await fetchRelatedProducts(supabase, product, 4);

  return (
    <PageShell>
      <ProductDetail product={product} related={related} />
    </PageShell>
  );
}
