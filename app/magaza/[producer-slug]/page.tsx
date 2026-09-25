import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { StoreListing, type StoreSearch } from "@/components/shop/store-listing";
import { isBrandPreview } from "@/lib/brand-preview";
import { sourceProducers } from "@/content/producers";
import { previewProducts } from "@/content/preview-products";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPublishedProducerBySlug } from "@/lib/producers";
import { fetchProductsByProducer } from "@/lib/catalog";

type Params = Promise<{ "producer-slug": string }>;

/** One producer read per request, shared by generateMetadata and the page. */
const getProducer = cache(async (slug: string) =>
  fetchPublishedProducerBySlug(await createSupabaseServerClient(), slug),
);

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const slug = (await params)["producer-slug"];
  if (isBrandPreview()) {
    const producer = sourceProducers.find((producer) => producer.slug === slug);
    return {
      title: producer ? `${producer.name} — Mağaza` : "Mağaza bulunamadı",
      robots: { index: false, follow: false },
    };
  }
  const result = await getProducer(slug);
  if (result.status !== "ok") return { title: "Mağaza bulunamadı" };
  return {
    title: `${result.producer.name} — Mağaza`,
    description:
      result.producer.story ??
      `${result.producer.name} — Kabia'nın güvendiği üreticilerden.`,
  };
}

export default async function ProducerStore({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<StoreSearch>;
}) {
  const slug = (await params)["producer-slug"];

  // Design-review preview: local editorial producers and example products.
  if (isBrandPreview()) {
    const producer = sourceProducers.find((producer) => producer.slug === slug);
    if (!producer) notFound();
    const products = previewProducts.filter(
      (product) => product.producerSlug === producer.slug,
    );

    return (
      <PageShell>
        <section className="wrap page-top">
          <p className="label text-olive">Mağaza</p>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
            {producer.name}
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            {producer.desc}
          </p>

          <div className="mt-14 md:mt-20">
            <StoreListing
              products={products}
              base={`/magaza/${producer.slug}`}
              search={await searchParams}
            />
          </div>
        </section>
      </PageShell>
    );
  }

  // Normal operation: the producer and its products come from the database,
  // so /magaza/[slug] reads like the main store with a narrower catalogue.
  // A read failure answers like an unknown slug — the test-double catalogue
  // has no producers, which keeps the off-state 404 expectations intact.
  const supabase = await createSupabaseServerClient();
  const result = await getProducer(slug);
  if (result.status !== "ok") notFound();
  const producer = result.producer;
  const products = await fetchProductsByProducer(supabase, producer.id);
  const subtitle = [producer.productType, producer.region]
    .filter(Boolean)
    .join(" — ");

  return (
    <PageShell>
      <section className="wrap page-top">
        <p className="label text-olive">Mağaza</p>
        <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
          {producer.name}
        </h1>
        {subtitle && (
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            {subtitle}
          </p>
        )}

        <div className="mt-14 md:mt-20">
          <StoreListing
            products={products}
            base={`/magaza/${producer.slug}`}
            search={await searchParams}
          />
        </div>
      </section>
    </PageShell>
  );
}
