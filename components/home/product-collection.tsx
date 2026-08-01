import Image from "next/image";
import Link from "next/link";
import { products as copy } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchFeaturedProducts, fetchProducts } from "@/lib/catalog";
import { categoryLabel, formatTL, type Product } from "@/lib/products";
import { routes } from "@/lib/site";
import { ArrowLink } from "@/components/ui/button";

/** Line-drawn almond used when a product has no photography yet. */
function ProductPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 border border-ink/10 bg-ivory">
      <svg
        viewBox="0 0 100 120"
        className="h-16 w-auto text-olive"
        aria-hidden="true"
      >
        <path
          d="M50 8 C72 30 80 58 70 84 C63 102 37 102 30 84 C20 58 28 30 50 8 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M48 24 C60 40 64 62 58 82"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <p className="label text-olive">{name} — fotoğraf hazırlanıyor</p>
    </div>
  );
}

/**
 * Products presented as a harvest ledger: numbered rows on paper, separated by
 * hairlines — no cards, no carousel.
 *
 * The rows are the real catalogue. Featured products lead; if nothing is
 * flagged featured the first few active products stand in, so the section is
 * never empty while the shop has stock.
 */
export async function ProductCollection() {
  const supabase = await createSupabaseServerClient();
  const featured = await fetchFeaturedProducts(supabase);
  const items: Product[] = (
    featured.length > 0 ? featured : await fetchProducts(supabase)
  ).slice(0, 4);

  return (
    <section
      id="urunler"
      aria-labelledby="products-heading"
      className="scroll-mt-20 border-y border-ink/10 bg-paper"
    >
      <div className="wrap py-24 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-5">
            <h2
              id="products-heading"
              className="text-3xl tracking-tight md:text-4xl"
            >
              {copy.title}
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-5 md:col-start-8">
            <p className="text-sm leading-relaxed text-ink/60">{copy.intro}</p>
          </Reveal>
        </div>

        {items.length === 0 ? (
          <Reveal className="mt-16 border-t border-ink/10 pt-10">
            <p className="max-w-md text-sm leading-relaxed text-ink/60">
              Bu sezonun ürünleri henüz yayında değil. Hasat takvimi için
              mağazayı takip edebilirsiniz.
            </p>
            <div className="mt-6">
              <ArrowLink href={routes.store}>Mağazaya git</ArrowLink>
            </div>
          </Reveal>
        ) : (
          <ul className="mt-16">
            {items.map((item, index) => (
              <Reveal
                as="li"
                key={item.id}
                className="grid gap-6 border-t border-ink/10 py-10 md:grid-cols-12 md:items-center md:gap-8 md:py-12"
              >
                <div className="flex items-baseline justify-between md:col-span-1 md:block">
                  <span className="font-serif text-xl text-shell">
                    0{index + 1}
                  </span>
                  <span className="label block text-olive md:mt-2">
                    {categoryLabel(item.category)}
                  </span>
                </div>

                <div className="md:col-span-4">
                  <Link
                    href={routes.product(item.slug)}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="group relative block aspect-[4/3] overflow-hidden rounded-media"
                  >
                    {item.mainImageUrl ? (
                      <Image
                        src={item.mainImageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <ProductPlaceholder name={item.name} />
                    )}
                  </Link>
                </div>

                <div className="md:col-span-4 md:col-start-7">
                  <h3 className="text-2xl tracking-tight">{item.name}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/60">
                    {item.shortDescription}
                  </p>
                  <p className="figure mt-4 text-lg text-ink">
                    {formatTL(item.price)}
                  </p>
                </div>

                <div className="md:col-span-2 md:justify-self-end">
                  <ArrowLink href={routes.product(item.slug)}>
                    <span>
                      İncele
                      <span className="sr-only"> — {item.name}</span>
                    </span>
                  </ArrowLink>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
