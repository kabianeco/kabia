import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { ProductEntry } from "@/components/shop/product-entry";
import { ArrowLink } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProducts } from "@/lib/catalog";
import { CATEGORIES, type Product, type ProductCategory } from "@/lib/products";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mağaza",
  description:
    "Geyve'deki bahçelerimizden çiğ badem, kavrulmuş badem, badem unu ve badem ezmesi. Katkısız, tek kaynaktan.",
  alternates: { canonical: "/shop" },
};

type SortOption = "onerilen" | "fiyat-artan" | "fiyat-azalan" | "en-yeni";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "onerilen", label: "Önerilen" },
  { id: "fiyat-artan", label: "Artan fiyat" },
  { id: "fiyat-azalan", label: "Azalan fiyat" },
  { id: "en-yeni", label: "En yeni" },
];

const isSort = (v: string | undefined): v is SortOption =>
  SORT_OPTIONS.some((o) => o.id === v);

/** Filters are links, not client state: the view stays server-rendered and
 *  every combination is a shareable URL. */
function shopHref(category: string, sort: SortOption) {
  const params = new URLSearchParams();
  if (category !== "tumu") params.set("kategori", category);
  if (sort !== "onerilen") params.set("sirala", sort);
  const qs = params.toString();
  return qs ? `${routes.store}?${qs}` : routes.store;
}

function sortProducts(list: Product[], sort: SortOption): Product[] {
  switch (sort) {
    case "fiyat-artan":
      return [...list].sort((a, b) => a.price - b.price);
    case "fiyat-azalan":
      return [...list].sort((a, b) => b.price - a.price);
    case "en-yeni":
      // fetchProducts returns oldest-first, so newest is the reverse.
      return [...list].reverse();
    default:
      return list;
  }
}

function GridSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Ürünler yükleniyor</span>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pt-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <div className="aspect-[4/5] animate-pulse rounded-media bg-paper" />
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
  sort,
}: {
  activeCategory: ProductCategory | "tumu";
  sort: SortOption;
}) {
  const supabase = await createSupabaseServerClient();
  const all = await fetchProducts(supabase);
  const filtered = all.filter(
    (p) => activeCategory === "tumu" || p.category === activeCategory,
  );
  const products = sortProducts(filtered, sort);

  if (products.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-2xl italic text-ink/70">
          {all.length === 0 ? "Mağaza şu an boş." : "Bu kategoride ürün yok."}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
          {all.length === 0
            ? "Yeni hasat yüklendiğinde ürünler burada listelenir."
            : "Diğer kategorilere göz atabilirsiniz."}
        </p>
        {all.length > 0 && (
          <div className="mt-8">
            <ArrowLink href={routes.store}>Tüm ürünler</ArrowLink>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="label pb-5 text-olive">{products.length} ürün</p>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
        {products.map((product, i) => (
          <ProductEntry key={product.id} product={product} priority={i < 3} />
        ))}
      </ul>
    </>
  );
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; sirala?: string }>;
}) {
  const { kategori, sirala } = await searchParams;
  const sort: SortOption = isSort(sirala) ? sirala : "onerilen";
  const activeCategory =
    kategori && CATEGORIES.some((c) => c.id === kategori)
      ? (kategori as ProductCategory)
      : "tumu";

  return (
    <PageShell>
      <section aria-labelledby="shop-heading">
        <div className="wrap page-top">
          <p className="label text-olive">Mağaza</p>
          <h1
            id="shop-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            Bahçeden <em className="font-serif italic text-brand">sofraya</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Geyve&apos;deki bahçelerimizde kimyasal gübre ve ilaç kullanmadan
            yetiştirilen badem. Katkı maddesi eklenmez.
          </p>
        </div>

        <div className="wrap mt-14 md:mt-20">
          <nav aria-label="Kategoriler" className="border-t border-ink/10 pt-5">
            <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
              {CATEGORIES.map((cat) => {
                const active = cat.id === activeCategory;
                return (
                  <li key={cat.id}>
                    <Link
                      href={shopHref(cat.id, sort)}
                      aria-current={active ? "true" : undefined}
                      className={`inline-flex min-h-11 items-center text-sm transition-colors duration-300 ${
                        active
                          ? "text-ink underline decoration-brand decoration-2 underline-offset-8"
                          : "text-ink/55 hover:text-ink"
                      }`}
                    >
                      {cat.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-4 border-b border-ink/10 pb-5">
            <nav aria-label="Sıralama">
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {SORT_OPTIONS.map((opt) => {
                  const active = opt.id === sort;
                  return (
                    <li key={opt.id}>
                      <Link
                        href={shopHref(activeCategory, opt.id)}
                        aria-current={active ? "true" : undefined}
                        className={`inline-flex min-h-11 items-center text-sm transition-colors duration-300 ${
                          active ? "text-brand" : "text-ink/50 hover:text-ink"
                        }`}
                      >
                        {opt.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="pt-14">
            <Suspense
              key={`${activeCategory}-${sort}`}
              fallback={<GridSkeleton />}
            >
              <ProductGrid activeCategory={activeCategory} sort={sort} />
            </Suspense>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
