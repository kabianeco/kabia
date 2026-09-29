import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import { PageShell } from "@/components/layout/page-shell";
import Link from "next/link";
import { FarmTimeline } from "@/components/farm/farm-timeline";
import { FaqList } from "@/components/faq/faq-list";
import { emanetManifesto, farmCertificate, farmOpening, farmPrinciples } from "@/content/farm";
import { farm } from "@/content/pages";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Çiftlik — Geyve Sabırlar'da 946 Ağaçlık Badem Bahçesi",
    description: farmOpening.body,
    path: "/ciftlik",
    keywords: ["organik badem", "kabuklu badem", "Marinada", "ekolojik çiftlik", "Geyve", "Kılıçkaya"],
  });
}

export default function FarmPage() {
  return (
    <PageShell>
      <section aria-labelledby="farm-heading">
        <div className="wrap page-top pb-16 md:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="label text-olive">Sabırlar Köyü — Geyve, Sakarya</p>
            <h1 id="farm-heading" className="mt-6 text-4xl leading-[1.08] tracking-tight md:text-6xl">946 ağaçlık <em className="font-theme-display italic text-brand">bir bahçe</em>.</h1>
            <p className="mt-7 text-base leading-relaxed text-ink/65">Kılıçkaya yamaçlarında, 2021’den beri <a href="#sertifika" className="underline decoration-ink/25 underline-offset-4 transition-colors duration-300 hover:text-ink hover:decoration-ink/60">organik sertifikalı</a> badem yetiştiriyoruz. Hikayenin başladığı yer burası.</p>
          </div>
        </div>
      </section>

      <section aria-label="Kuruluş hikayesi" className="border-t border-ink/10">
        <div className="wrap grid max-w-3xl gap-6 py-24 md:py-32">
          <p className="label text-olive">Kuruluş hikayesi</p>
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
              <Image
                src="/images/bostarla.jpg"
                alt="2019 Kasım — Bahçe kurulmadan önce, Sabırlar"
                fill
                sizes="(min-width: 768px) 60vw, 100vw"
                className="object-cover"
                // The page's LCP element, in the first viewport: loaded eagerly
                // at high priority (no preload link). Applied-throttling LCP
                // 4575 -> 2248 ms; Lighthouse's simulated LCP reads this as
                // slower (see SEO/perf pass 2 report), the real waterfall is not.
                loading="eager"
                fetchPriority="high"
              />
            </div>
            <figcaption className="mt-3 text-xs text-olive">
              — 2019 Kasım: kurulmadan önce, boş tarla ve dinleme.
            </figcaption>
          </figure>
          <p className="max-w-xl text-base leading-relaxed text-ink/65">
            2019 Kasım’ında Sabırlar’da boş bir tarlaya bakıp dinlemeye
            geldik. Bir yıl boyunca tek fidan dikmeden yalnızca toprağı
            gözlemledik — cesaret o gün, bu anızda filizlendi.
          </p>
          <h2 className="text-2xl tracking-tight md:text-3xl">
            Bazı hikâyeler bir fikirle değil, bir yerle başlar.
          </h2>
          <div className="grid max-w-xl gap-5 text-base leading-relaxed text-ink/65">
            <p>Bizimki Kılıçkaya’nın yamaçlarında başladı.</p>
            <p>
              2021 yılında, Geyve’de 946 badem ağacını toprakla buluşturduk.
              O günlerde bunun yıllar sonra Kabia adını taşıyan bir hikâyeye
              dönüşeceğini bilmiyorduk.
            </p>
            <p>
              Bildiğimiz tek şey vardı:
              <br />
              Bir bahçe kurmak istiyorduk.
            </p>
            <p>Sonra bahçe bizi değiştirmeye başladı.</p>
            <p>
              Mevsimleri takvimden değil ağaçlardan okumayı öğrendik. İlk
              tomurcuğu beklemeyi, yağmurun sesine başka türlü kulak vermeyi,
              gecenin ayazını dert etmeyi, küçücük bir çağlanın dalda
              kalmasına sevinmeyi…
            </p>
            <p>
              Bazı yıllar doğa cömertti.
              <br />
              Bazı yıllar ise değildi.
            </p>
            <p>
              Emek verdiğimiz, aylarca beklediğimiz bir hasadın dört soğuk
              günün ardından nasıl kaybolabildiğini de gördük. Yeniden
              başlamanın ne demek olduğunu da.
            </p>
            <p>Ama hiçbirinde bahçeden vazgeçmedik.</p>
            <p>
              Çünkü bir süre sonra anladık ki yetiştirdiğimiz şey yalnızca
              badem değildi.
            </p>
            <p>Biz de bu bahçeyle birlikte büyüyorduk.</p>
            <p>
              Yıllar geçtikçe 946 ağacın her birinin başka bir huyu olduğunu
              öğrendik. Biri hızla büyüdü, biri yıllarca nazlandı. Biri ilk
              çiçeğini erkenden gösterdi, diğeri bekletti.
            </p>
            <p>Ve Kabia tam da burada doğdu.</p>
            <p>
              Bir şirket toplantısında, bir pazarlama planında ya da güzel
              bir ambalajın üzerinde değil.
            </p>
            <p>Bir bahçenin içinde.</p>
            <p>
              Toprağa basarak, hata yaparak, öğrenerek, bazen kaybederek,
              yeniden deneyerek…
            </p>
            <p>
              Bugün Kabia’nın üzerinde bir ürün gördüğünüzde, arkasında
              kusursuz bir tarım hikâyesi yok.
            </p>
            <p>Daha gerçek bir şey var.</p>
            <p>
              Beş yılın mevsimleri, 946 ağacın izi, Kılıçkaya’nın rüzgârı ve
              hâlâ her yıl öğrenmeye devam eden küçük bir çiftlik.
            </p>
            <p>Her şey bir badem bahçesiyle başladı.</p>
            <p className="font-theme-display text-xl italic text-ink">
              Gerisi hâlâ yazılıyor.
            </p>
          </div>
        </div>
      </section>

      {/* Kurucu imzası: kuruluş hikayesinin sonunda, anlatanın yüzü.
          Alıntı yok — hikayenin kendisi imza, bu blok yalnızca kimin
          anlattığını gösterir. */}
      <section aria-label="Kurucu" className="border-t border-ink/10">
        <div className="wrap grid items-center gap-10 py-24 md:grid-cols-12 md:py-32">
          <div className="md:col-span-4">
            <div className="relative aspect-[3/4] overflow-hidden rounded-media bg-paper">
              <Image
                src="/images/necmettin-sivaci.jpg"
                alt="Kabia Ekolojik'in sahibi Necmettin Sıvacı badem bahçesinde"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <p className="label text-olive">Kurucu</p>
            <h2 className="mt-5 text-3xl leading-[1.1] tracking-tight md:text-4xl">
              Necmettin Sıvacı
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink/65">
              Kabia Ekolojik&apos;in sahibi. Yukarıdaki hikâyede geçen her
              &ldquo;biz&rdquo;in arkasında o var — tarlayı dinlemeye gelen
              de, fidanı diken de.
            </p>
          </div>
        </div>
      </section>

      {/* Çiftlik kartı: rakamlar + iki fotoğraf, altlarında kendi hikâyeleri. */}
      <section aria-label="Çiftlik özeti" className="border-t border-ink/10">
        <div className="wrap py-24 md:py-32">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
            {farm.stats.map((s) => (
              <div key={s.label} className="border-t border-ink/10 pt-5">
                <dt className="label text-olive">{s.label}</dt>
                <dd className="figure mt-2 text-3xl text-ink md:text-4xl">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-14 grid gap-8 md:grid-cols-2 md:gap-12">
            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
                <Image
                  src="/images/bademagaclari.jpg"
                  alt="Badem ağaçları 3. yıl, Kılıçkaya yamaçları"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-xs text-olive">
                — Badem ağaçları 3. yıl, Kılıçkaya yamaçları.
              </figcaption>
            </figure>
            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
                <Image
                  src="/images/yesilbadem.jpg"
                  alt="Dalında yeşil kabuklu Marinada bademleri"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-xs text-olive">
                — Yeşil kabuklu Marinada, dalında olgunlaşıyor.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <FarmTimeline />
      <section aria-label="Bademi tanı" className="on-dark bg-forest text-cream">
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="label text-shell">Kabuklu Badem</p>
          <a
            href="/badem"
            className="group mx-auto mt-5 block max-w-xl font-theme-display text-2xl italic leading-snug transition-colors duration-300 hover:text-shell md:text-4xl"
          >
            Kabia bademini tanıyın.
            <span aria-hidden="true" className="ml-3 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </a>
        </div>
      </section>

      {/* Tam manifesto: kronolojinin cevabı — hikaye okundu, şimdi anlamı.
          Footer'daki Emanet linki buraya iner. */}
      <section id="emanet" aria-label="Emanet manifestosu" className="border-t border-ink/10 scroll-mt-20">
        <div className="wrap py-24 md:py-32">
          <div className="mx-auto max-w-2xl">
            <p className="label text-olive">Emanet</p>
            <h2 className="mt-6 text-3xl leading-[1.1] tracking-tight md:text-4xl">
              Toprağı emanet <em className="font-theme-display italic text-brand">gibi görüyoruz</em>.
            </h2>
            <div className="mt-10">
            {emanetManifesto.map((p, i) => (
              <p
                key={i}
                className={
                  p.tone === "quote"
                    ? "mt-6 font-theme-display text-2xl italic leading-snug md:text-3xl"
                    : p.tone === "closing"
                      ? "mt-2 text-base font-semibold leading-relaxed text-ink"
                      : "mt-5 text-base leading-relaxed text-ink/65 first:mt-0"
                }
              >
                {p.text}
              </p>
            ))}
            </div>
          </div>
        </div>
      </section>

      {/* The nav's "Yaklaşım" lands here, so the id has to clear the fixed
          header the same way the homepage sections do. */}
      <section
        id="yaklasim"
        data-farm-approach
        aria-labelledby="farm-approach-heading"
        className="scroll-mt-20"
      >
        <div className="wrap py-24 md:py-32">
          <h2 id="farm-approach-heading" className="label text-olive">Yaklaşım</h2>
          <ol className="mt-10">
            {farmPrinciples.map((principle, index) => (
              <li key={principle} className="grid gap-4 border-t border-ink/10 py-10 md:grid-cols-12 md:items-baseline md:py-14">
                <span aria-hidden="true" className="font-serif text-xl text-shell md:col-span-1">0{index + 1}</span>
                <p className="font-theme-display text-3xl italic tracking-tight md:col-span-10 md:text-4xl">{principle}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Yöntemler: ilkelerin sahadaki karşılığı — neyi, nasıl, neyle
          yaptığımız. Fotoğraflar kendi bahçemizden, metinler uyguladığımız
          gerçeğin aynısı. */}
      <section
        aria-labelledby="farm-methods-heading"
        className="border-t border-ink/10"
      >
        <div className="wrap py-24 md:py-32">
          <p className="label text-olive">Yöntemlerimiz</p>
          <h2
            id="farm-methods-heading"
            className="mt-6 max-w-2xl text-3xl leading-[1.1] tracking-tight md:text-4xl"
          >
            İlkeler sahada <em className="font-theme-display italic text-brand">böyle</em> görünür.
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
            <li>
              <div className="relative aspect-[4/3] overflow-hidden rounded-theme-image bg-paper">
                <Image
                  src="/images/uretim-surmeme.jpg"
                  alt="Sürülmeden bırakılmış bahçe toprağı"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <h3 className="mt-5 text-xl tracking-tight">Sürmüyoruz</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/65">
                5 yıldır toprağı sürmüyoruz. Pulluk mantar ağını parçalar — biz
                orman zeminini taklit ediyoruz.
              </p>
            </li>
            <li>
              <div className="relative aspect-[4/3] overflow-hidden rounded-theme-image bg-paper">
                <Image
                  src="/images/uretim-bicim.jpg"
                  alt="Biçilmemiş ot örtüsüyle bahçe"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <h3 className="mt-5 text-xl tracking-tight">Biçmiyoruz</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/65">
                Ot rakibimiz değil; toprağın örtüsü, böceğin evi. Biçmek
                yerine yatırıyoruz — malç oluyor, nemi tutuyor.
              </p>
            </li>
            <li className="border-t border-ink/10 pt-8">
              <h3 className="text-xl tracking-tight">Kompost ve kompost çayı</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/65">
                Dışarıdan gübre almıyoruz. Orman kompostu ve kompost çayıyla
                toprağı kendi bahçemizden besliyoruz.
              </p>
            </li>
            <li className="border-t border-ink/10 pt-8">
              <h3 className="text-xl tracking-tight">Doğal killer ile koruma</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/65">
                İlaç yerine doğal killer — bitkiyi kapatır, zararlıyı uzak
                tutar. Dozunda, mevsiminde.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Yavaş ve gelecek: toprağın ritmine dair iki inanç — sertifika
          belgesinden önce, insan sesi. */}
      <section aria-label="Yavaş ve gelecek" className="border-t border-ink/10">
        <div className="wrap grid max-w-3xl gap-12 py-24 md:py-32">
          <div>
            <h2 className="text-2xl tracking-tight md:text-3xl">Yavaş büyüyen şeylere inanıyoruz.</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/65">
              Bugün her şeyin daha hızlı olması bekleniyor. Biz ise toprağın
              ve ağacın kendi zamanına biraz daha yakın durmaya çalışıyoruz.
              Çünkü iyi bir toprağı bir gecede oluşturamazsınız. Güven de
              böyledir. Biz Kabia’yı da böyle büyütmek istiyoruz.{" "}
              <strong className="text-ink">Yavaş. Gerçek. Kalıcı.</strong>
            </p>
          </div>
          <div>
            <h2 className="text-2xl tracking-tight md:text-3xl">Bugün ve gelecek</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/65">
              2019’da toprağı dinleyerek başlayan, 2021’de 946 fidanla bahçeye
              dönüşen yolculuğumuz devam ediyor. Badem bahçemiz
              büyüyor, toprağı daha iyi anlamaya çalışıyoruz. Yeni yöntemler
              deniyoruz. Ve çevremizde aynı değerlere inanan üreticilerle bağ
              kuruyoruz. Hayalimiz yalnızca kendi ürünlerimizi satmak değil —{" "}
              <strong className="text-ink">
                üretici ile tüketici arasında yeniden güven kurabilen bir yapı oluşturmak.
              </strong>
            </p>
          </div>
        </div>
      </section>

      {/* The certificate closes the approach rather than opening the page: the
          principles above are the claim, and this is the part of it somebody
          outside the bahçe signed. The document is the object here, so it is
          shown at a size worth looking at and opens full-size for anyone who
          wants to read the small print. */}
      <section
        id="sertifika"
        aria-labelledby="farm-certificate-heading"
        className="border-t border-ink/10 scroll-mt-20"
      >
        <div className="wrap py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-5">
              <a
                href={farmCertificate.image}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Image
                  src={farmCertificate.image}
                  alt={farmCertificate.imageAlt}
                  width={farmCertificate.imageWidth}
                  height={farmCertificate.imageHeight}
                  sizes="(max-width: 767px) 100vw, 40vw"
                  className="h-auto w-full rounded-theme-image border border-ink/10 bg-paper shadow-theme-image"
                />
                <span className="label mt-5 inline-block text-olive transition-colors duration-300 group-hover:text-ink">
                  {farmCertificate.viewLabel}
                  <span
                    aria-hidden="true"
                    className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </a>
            </div>

            <div className="md:col-span-6 md:col-start-7">
              <p className="label text-olive">{farmCertificate.eyebrow}</p>
              <h2
                id="farm-certificate-heading"
                className="mt-6 text-3xl leading-[1.1] tracking-tight md:text-4xl"
              >
                {farmCertificate.title}
              </h2>
              {farmCertificate.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-6 text-base leading-relaxed text-ink/65"
                >
                  {paragraph}
                </p>
              ))}
              <dl className="mt-10 border-t border-ink/10">
                {farmCertificate.facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="grid gap-1 border-b border-ink/10 py-4 md:grid-cols-3 md:gap-6"
                  >
                    <dt className="label text-olive">{fact.label}</dt>
                    <dd className="text-sm leading-relaxed md:col-span-2">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* One FAQPage for the page, covering both visible lists. */}
      <FaqList group="ciftlik" structuredData={["ciftlik", "emanet"]} />
      <FaqList group="emanet" heading="Emanet hakkında" structuredData={false} />

      <section aria-label="Mağaza" className="border-t border-ink/10">
        <div className="wrap py-24 text-center md:py-32">
          <p className="label text-olive">Mağaza</p>
          <p className="mx-auto mt-6 max-w-xl font-theme-display text-2xl italic leading-snug md:text-4xl">
            Bu toprağın hasadını tat.
          </p>
          <Link
            href="/magaza"
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-7 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Mağaza
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
