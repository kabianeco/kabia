import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { PageShell } from "@/components/layout/page-shell"
import { ProducerCard } from "@/components/producers/producer-card"
import { FaqList } from "@/components/faq/faq-list"
import { producerCollections } from "@/content/producers"

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
 * The four Seçki producers, taken from the explicit collection rather than by
 * excluding farm and kitchen records — an exclusion filter is what previously
 * let a kitchen product surface in a producer list.
 */
export default function SeckiPage() {
  const producers = producerCollections.secki

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

      <FaqList group="secki" />
    </PageShell>
  )
}
