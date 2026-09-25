import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { StoreListing } from "@/components/shop/store-listing";
import { isBrandPreview } from "@/lib/brand-preview";
import { previewProducts } from "@/content/preview-products";
import { SORT_OPTIONS } from "@/lib/store-listing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPublicProducts } from "@/lib/catalog";
import { ALL_CATEGORIES, SOURCES, type ProductSource } from "@/lib/products";
import { routes } from "@/lib/site";
import { getPublicSettings } from "@/lib/settings";
import { shopBannerVisible, type ShopBannerSettings } from "@/lib/shop-banner";
import { ShopHeroBanner } from "@/components/shop/shop-hero-banner";

/** /shop and /magaza render the same listing; both canonicalise to /magaza. */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Mağaza",
    description:
      "Kabuklu badem, kabuklu fındık, kabuklu ceviz, bal, ıhlamur, salça, sirke, erişte, tarhana. Katkısız, izlenebilir, hikâyesiyle.",
    path: "/magaza",
    keywords: [
    "kabuklu badem",
    "organik badem",
    "kabuklu fındık",
    "kabuklu ceviz",
    "doğal bal",
    "ıhlamur",
    "domates salçası",
    "elma sirkesi",
    "erişte",
    "tarhana",
  ],
  });
}

type SortOption = typeof SORT_OPTIONS[number]["id"];
const isSort = (value: string | undefined): value is SortOption => SORT_OPTIONS.some(option => option.id === value);

function GridSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Ürünler yükleniyor</span>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pt-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <div className="aspect-[4/5] animate-pulse rounded-theme-product-image bg-paper" />
            <div className="mt-5 border-t border-ink/10 pt-4">
              <div className="h-3 w-16 animate-pulse bg-paper" />
              <div className="mt-3 h-5 w-3/4 animate-pulse bg-paper" />
              <div className="mt-3 h-5 w-20 animate-pulse bg-paper" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The catalogue read is isolated in its own async component so only the grid
 * streams. Keeping the Suspense boundary here — rather than in a segment-level
 * loading.tsx — means `/shop/[slug]` is not wrapped in one, which is what lets
 * an unknown product still answer with a real 404 instead of a streamed 200.
 */
async function ProductGrid({
  activeCategory,
  activeSource,
  sort,
}: {
  activeCategory: string;
  activeSource: ProductSource | "tumu";
  sort: SortOption;
}) {
  const search = { kategori: activeCategory, kaynak: activeSource, sirala: sort };
  if (isBrandPreview()) return <StoreListing products={previewProducts} base={routes.store} search={search} />;
  const result = await fetchPublicProducts(await createSupabaseServerClient());
  return <StoreListing products={result.status === "error" ? [] : result.products} error={result.status === "error"} base={routes.store} search={search} />;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; kaynak?: string; sirala?: string }>;
}) {
  const { kategori, kaynak, sirala } = await searchParams;
  const settings = await getPublicSettings();
  const banner: ShopBannerSettings = {
    enabled: settings.shopBannerEnabled,
    headline: settings.shopBannerHeadline,
    subtext: settings.shopBannerSubtext,
    imageUrl: settings.shopBannerImageUrl,
    ctaLabel: settings.shopBannerCtaLabel,
    ctaHref: settings.shopBannerCtaHref,
  };
  const showBanner = shopBannerVisible(banner);
  const sort: SortOption = isSort(sirala) ? sirala : "onerilen";
  // Categories are rows now, and the grid that knows which ones exist streams
  // in behind Suspense — so membership cannot be checked here. What is checked
  // is the shape: a slug, or nothing. An unknown-but-well-formed slug reaches
  // the grid and resolves to an empty one, which is the honest answer for a
  // category that is not in the catalogue.
  const activeCategory: string =
    kategori && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kategori) && kategori.length <= 80
      ? kategori
      : ALL_CATEGORIES;
  const activeSource =
    kaynak && SOURCES.some((s) => s.id === kaynak)
      ? (kaynak as ProductSource)
      : ALL_CATEGORIES;

  return (
    <PageShell>
      {showBanner && (
        <ShopHeroBanner
          headline={banner.headline}
          subtext={banner.subtext}
          imageUrl={banner.imageUrl}
          ctaLabel={banner.ctaLabel}
          ctaHref={banner.ctaHref}
        />
      )}
      <section aria-labelledby="shop-heading">
        <div className={showBanner ? "wrap mt-14 md:mt-20" : "wrap page-top"}>
          <p className="label text-olive">Mağaza</p>
          <h1
            id="shop-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            <em className="font-theme-display italic text-brand">Mağaza</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Önce hikâyesini okumanızı isteriz — nereden geldiğini, neden
            Kabia&apos;da olduğunu. Sonra hasattan dilediğinizi seçebilirsiniz.
          </p>
        </div>

        <div className="wrap mt-14 md:mt-20">
          <div className="pt-14">
            <Suspense
              key={`${activeCategory}-${activeSource}-${sort}`}
              fallback={<GridSkeleton />}
            >
              <ProductGrid
                activeCategory={activeCategory}
                activeSource={activeSource}
                sort={sort}
              />
            </Suspense>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
