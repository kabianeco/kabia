import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { PageShell } from "@/components/layout/page-shell"
import { ProducerCard } from "@/components/producers/producer-card"
import type { CardProducer } from "@/components/producers/producer-card"
import { FaqList } from "@/components/faq/faq-list"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchProducersBySource } from "@/lib/producers"
import { producerCollections } from "@/content/producers"
import { isBrandPreview } from "@/lib/brand-preview"

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Mutfak",
    description:
      "Üreticilerin mutfağından: erişte, tarhana, salça, sirke. Geleneksel yöntemler, tanıdığımız eller.",
    path: "/mutfak",
    keywords: ["erişte", "tarhana", "domates salçası", "elma sirkesi", "alıç sirkesi", "geleneksel mutfak"],
  })
}

/**
 * The Mutfak line from the database in curated order — the single source of
 * truth since convergence. A failed read is an outage, never an empty shelf.
 * Preview keeps the static file as its fixture.
 */
export default async function MutfakPage() {
  let producers: CardProducer[] | null = null
  if (isBrandPreview()) {
    producers = [...producerCollections.mutfak]
  } else {
    const result = await fetchProducersBySource(await createSupabaseServerClient(), "mutfak")
    if (result.status === "error") {
      return (
        <PageShell>
          <section aria-labelledby="mutfak-heading">
            <div className="wrap page-top pb-16 md:pb-24">
              <p className="label text-olive">Mutfak</p>
              <h1
                id="mutfak-heading"
                className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
              >
                Üreticilerin{" "}
                <em className="font-theme-display italic text-brand">mutfağından</em>.
              </h1>
            </div>
            <div role="alert" className="wrap flex flex-col items-start pb-24 md:pb-32">
              <p className="font-theme-display text-3xl italic text-clay">
                Üretici profilleri şu anda yüklenemiyor.
              </p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
                Lütfen daha sonra yeniden deneyin.
              </p>
            </div>
          </section>
        </PageShell>
      )
    }
    producers = result.producers
  }

  return (
    <PageShell>
      <section aria-labelledby="mutfak-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <p className="label text-olive">Mutfak</p>
          <h1
            id="mutfak-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            Üreticilerin{" "}
            <em className="font-theme-display italic text-brand">mutfağından</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Erişte, tarhana, salça, sirke — güvendiğimiz üreticilerin
            geleneksel mutfağından. Her ürünün üreticisi ve hikâyesi görünür.
          </p>
        </div>

        <div className="wrap">
          <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
            {producers.map((producer, i) => (
              <ProducerCard
                key={producer.id}
                producer={producer}
                priority={i < 3}
                variant="secki"
              />
            ))}
          </ul>
        </div>
      </section>

      <FaqList group="mutfak" />
    </PageShell>
  )
}
