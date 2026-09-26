import Link from "next/link";
import { ArrowLink } from "@/components/ui/button";
import { ProductEntry } from "@/components/shop/product-entry";
import { CategorySelect } from "@/components/shop/category-select";
import { SortSelect } from "@/components/shop/sort-select";
import {
  listingHref,
  presentCategories,
  presentSources,
  selectProducts,
  SORT_OPTIONS,
} from "@/lib/store-listing";
import type { Product } from "@/lib/products";

export type StoreSearch = {
  kategori?: string;
  kaynak?: string;
  sirala?: string;
};

/**
 * The one listing shared by /shop, /magaza and /magaza/[producer-slug], so the
 * whole store reads as one place.
 *
 * Presentation is the shop index as it stands on main: the same filter bar
 * treatment, the same three-column ProductEntry grid, the same count line and
 * the same empty and error states. What this adds is option A: the sources
 * stay as the row, because the catalogue now comes from three of them, while
 * category and sort sit as controls on the right.
 */

/** Selected filters read as links, so every combination stays a shareable URL. */
const linkClass = (active: boolean) =>
  `inline-flex min-h-11 items-center text-sm transition-colors duration-300 ${
    active
      ? "text-ink underline decoration-brand decoration-2 underline-offset-8"
      : "text-ink/55 hover:text-ink"
  }`;

export function StoreListing({
  products: all,
  error = false,
  base,
  search,
}: {
  products: Product[];
  error?: boolean;
  base: string;
  search: StoreSearch;
}) {
  const source = search.kaynak ?? "tumu";
  const sort = SORT_OPTIONS.some((option) => option.id === search.sirala)
    ? search.sirala!
    : "onerilen";

  const categories = presentCategories(all, source);
  // A category that does not survive the current source selection falls back to
  // Tümü rather than resolving to an empty grid.
  const requested = search.kategori ?? "tumu";
  const category = categories.some((c) => c.id === requested) ? requested : "tumu";

  const products = selectProducts(all, category, source, sort);
  const sources = presentSources(all);
  const href = (c: string, s: string, order = sort) =>
    listingHref(base, c, s, order);

  return (
    <div data-store-listing>
      <div className="flex flex-wrap items-end justify-between gap-x-7 gap-y-4 border-y border-ink/10 py-5">
        <nav aria-label="Kaynaklar" className="min-w-0">
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {sources.map((entry) => {
              const active = entry.id === source;
              return (
                <li key={entry.id}>
                  <Link
                    href={href(entry.id === "tumu" ? "tumu" : category, entry.id)}
                    prefetch={false}
                    aria-current={active ? "true" : undefined}
                    className={linkClass(active)}
                  >
                    {entry.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
          <CategorySelect
            value={category}
            options={categories.map((cat) => ({
              id: cat.id,
              label: cat.label,
              href: href(cat.id, source),
            }))}
          />
          <SortSelect
            value={sort}
            options={SORT_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
              href: href(category, source, option.id),
            }))}
          />
        </div>
      </div>

      <div className="pt-14">
        {error ? (
          <div role="alert" className="py-24 text-center">
            <p className="font-theme-display text-2xl italic text-clay">
              Ürünler şu anda yüklenemiyor.
            </p>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
                Mağaza açık kalacak. Lütfen daha sonra yeniden deneyin.
              </p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-theme-display text-2xl italic text-ink/70">
              {all.length === 0 ? "Mağaza şu an boş." : "Bu kategoride ürün yok."}
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
              {all.length === 0
                ? "Yeni hasat yüklendiğinde ürünler burada listelenir."
                : "Diğer kategorilere göz atabilirsiniz."}
            </p>
            {all.length > 0 && (
              <div className="mt-8">
                <ArrowLink href={base} prefetch={false}>
                  Tüm ürünler
                </ArrowLink>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="label pb-5 text-olive">{products.length} ürün</p>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
              {products.map((product, i) => (
                <ProductEntry key={product.id} product={product} priority={i < 1} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
