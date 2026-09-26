import type { Metadata } from "next"
import Link from "next/link"
import { pageMetadata } from "@/lib/seo"
import { PageShell } from "@/components/layout/page-shell"
import { process } from "@/content/homepage"

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Badem",
    description:
      "Bademimizi tanıyın: Marinada, Geyve/Sakarya, Kabia Çiftliği, organik sertifikalı. Bahçeden sofraya altı adımda.",
    path: "/badem",
    keywords: ["organik badem", "kabuklu badem", "Marinada badem", "Geyve badem"],
  })
}

const notes = [
  {
    title: "Kabuğun altında",
    body: "Bir bademin iyi olması için bahçede başlayan özenin sofraya kadar sürmesi gerekir. Kabia bu zinciri kendi elinde tutar: yetiştirir, kurutur, hazırlar.",
  },
  {
    title: "Zamanla olgunlaşır",
    body: "İyi badem, zamana gösterilen saygıyla oluşur. Dalda olgunlaşmayı, güneşte kurumayı, sırasını beklemeyi ister. Lezzet, acele edilmeden kurulan bir sürecin sonucudur.",
  },
  {
    title: "Badem aceleye gelmez",
    body: "Geyve'nin dağ köyü Sabırlar'da badem yetiştiririz. Bahçeye kimyasal gübre ve ilaç girmez; ürüne katkı maddesi eklenmez. Çok tonajlı üretim yerine temiz ve sağlıklı gıda üretmeyi tercih ediyoruz.",
  },
]

/**
 * The almond, told once and fully: three notes plus the same seven steps
 * the homepage process section walks. Single source (content/homepage.ts),
 * so the two can never drift apart.
 */
export default function BademPage() {
  return (
    <PageShell>
      <section aria-labelledby="badem-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <p className="label text-olive">Kabia Bademi</p>
          <h1
            id="badem-heading"
            className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl"
          >
            Bademimizi <em className="font-theme-display italic text-brand">tanıyın</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Bir bademin hikâyesi — bahçeden sofraya. Bademimiz organik
            sertifikalı, üretim modelimiz ise ekolojik.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            {["Marinada", "Geyve / Sakarya", "Kabia Çiftliği", "Organik sertifikalı"].map(
              (m) => (
                <span
                  key={m}
                  className="label rounded-full border border-ink/10 bg-paper px-3 py-1.5 text-ink/65"
                >
                  {m}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="wrap">
          <ul className="grid grid-cols-1 gap-x-8 gap-y-10 pb-16 sm:grid-cols-2 md:pb-24 lg:grid-cols-3">
            {notes.map((n) => (
              <li key={n.title} className="border-t border-ink/10 pt-6">
                <h2 className="text-xl tracking-tight">{n.title}</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/65">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-ink/10 py-16 md:py-20">
            <h2 className="max-w-xl text-2xl tracking-tight md:text-3xl">
              Organik dediğimizde <em className="font-theme-display italic text-brand">ne kastediyoruz</em>?
            </h2>
            <p className="mt-5 max-w-prose text-base leading-relaxed text-ink/70">
              Bademlerimizin hepsi aynı kalibrede, aynı büyüklükte değildir —
              olamaz da. Yıla, ağaca, mevsime göre değişir; içinden küçük ya
              da boş taneler çıkabilir. Konvansiyonel tarımda tek tiplilik
              kimyasalla ve standartlamayla sağlanır. Biz o yoldan gitmiyoruz:
              ağaç ne verirse soframıza o geliyor. Bu bir kusur değil,
              kimyasal kullanmayan üretimin ta kendisidir.
            </p>
          </div>

          <ol className="pb-24 md:pb-8">
            {process.steps.map((step, index) => (
              <li
                key={step.name}
                className="grid gap-2 border-t border-ink/10 py-8 md:grid-cols-12 md:gap-8 md:py-10"
              >
                <span aria-hidden="true" className="font-serif text-xl text-shell md:col-span-1">
                  0{index + 1}
                </span>
                <h3 className="text-2xl tracking-tight md:col-span-3">{step.name}</h3>
                <p className="max-w-md text-sm leading-relaxed text-ink/60 md:col-span-6 md:col-start-6">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>

          <div className="border-t border-ink/10 py-16 text-center md:py-24">
            <p className="label text-olive">Kabuklu Badem</p>
            <p className="mx-auto mt-6 max-w-xl font-theme-display text-2xl italic leading-snug md:text-4xl">
              Altı adımı okudun — yedincisi sofrada.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop/kabuklu-badem"
                className="inline-flex min-h-11 items-center rounded-full bg-brand px-7 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
              >
                Kabuklu Badem — Mağazada gör →
              </Link>
              <Link
                href="/magaza"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-ink/60 transition-colors duration-300 hover:text-ink"
              >
                Mağaza
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
