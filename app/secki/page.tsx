import type { Metadata } from "next"
import { Suspense } from "react"
import { pageMetadata } from "@/lib/seo"
import { PageShell } from "@/components/layout/page-shell"
import { ProducerCard } from "@/components/producers/producer-card"
import { FaqList } from "@/components/faq/faq-list"
import { getCachedSeckiProducers } from "@/lib/producers"
import type { CardProducer } from "@/components/producers/producer-card"
import { producerCollections } from "@/content/producers"
import { isBrandPreview } from "@/lib/brand-preview"

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Seçki",
    description:
      "Kendi çiftliğimizin ötesinde: üretim anlayışına güvendiğimiz, tanıdığımız küçük üreticiler.",
    path: "/secki",
    keywords: ["kabuklu fındık", "doğal fındık", "kabuklu ceviz", "doğal bal", "ıhlamur", "tanıdık üretici"],
  })
}

/**
 * The four Seçki producers from the database in curated order — the single
 * source of truth since convergence. A failed read is an outage (same
 * markup language as /ureticiler), never an empty shelf. Preview keeps the
 * static file as its fixture.
 *
 * Streaming: the grid resolves inside Suspense with the static rows as the
 * fallback (identical post-convergence, so the swap is invisible) — the
 * heading and first HTML never wait on the producers read.
 */
async function SeckiGrid() {
  if (isBrandPreview()) {
    return <SeckiGridRows producers={[...producerCollections.secki]} />
  }
  const result = await getCachedSeckiProducers()
  if (result.status === "error") {
    return (
      <div role="alert" className="wrap flex flex-col items-start pb-24 md:pb-32">
        <p className="font-theme-display text-3xl italic text-clay">
          Üretici profilleri şu anda yüklenemiyor.
        </p>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
          Lütfen daha sonra yeniden deneyin.
        </p>
      </div>
    )
  }
  return <SeckiGridRows producers={result.producers} />
}

function SeckiGridRows({ producers }: { producers: CardProducer[] }) {
  return (
    <div className="wrap">
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
        {producers.map((producer, i) => (
          <ProducerCard
            key={producer.id}
            producer={producer}
            priority={i === 0}
            variant="secki"
          />
        ))}
      </ul>
    </div>
  )
}

export default function SeckiPage() {
  return (
    <PageShell>
      <section aria-labelledby="secki-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <p className="label text-olive">Seçki</p>
          <h1
            id="secki-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            Tanıdığımız <em className="font-theme-display italic text-brand">üreticiler</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Her ürünü biz üretmiyoruz. Üreticisini tanır, üretim yerini görür,
            nasıl yapıldığını sorarız — sonra seçeriz.
          </p>
        </div>

        <Suspense fallback={<SeckiGridRows producers={[...producerCollections.secki]} />}>
          <SeckiGrid />
        </Suspense>
      </section>

      <FaqList group="secki" />
    </PageShell>
  )
}
