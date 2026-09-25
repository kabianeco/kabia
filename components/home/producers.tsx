import { ProducerCard } from "@/components/producers/producer-card";
import { Reveal } from "@/components/motion/reveal";
import { ArrowLink } from "@/components/ui/button";
import { producerCollections } from "@/content/producers";
import { routes } from "@/lib/site";

/**
 * The Seçki producers on the homepage — people before products.
 *
 * The same editorial cards as /secki (photo, person, product type, story
 * first and shop second), so the homepage carries the 3000 soul: the story
 * sells, then the product. The Mutfak line stays product-led on its own
 * page; here only the four Seçki producers appear.
 */
export function Producers() {
  const producers = producerCollections.secki;

  return (
    <section
      id="ureticiler"
      aria-labelledby="producers-heading"
      className="scroll-mt-20 border-b border-ink/10 bg-paper"
    >
      <div className="wrap py-24 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-7">
            <p className="label text-olive">Üreticiler</p>
            <h2
              id="producers-heading"
              className="mt-6 text-3xl leading-[1.15] tracking-tight md:text-4xl"
            >
              Bir ürünün arkasında
              <br />
              <em className="font-theme-display italic text-ink/80">
                her zaman bir insan vardır.
              </em>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-4 md:col-start-9">
            <p className="text-sm leading-relaxed text-ink/60">
              Fındığı kim topladı, balı kim sağdı? İsimleri, yüzleriyle —
              hikâyeleri kendi ağızlarından.
            </p>
          </Reveal>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {producers.map((producer) => (
            // Several screens below the fold, under the intro: these load
            // lazily rather than being preloaded against the hero.
            <ProducerCard
              key={producer.id}
              producer={producer}
              variant="secki"
            />
          ))}
        </ul>

        <Reveal className="mt-14 border-t border-ink/10 pt-7">
          <ArrowLink href={routes.producers}>Tüm üreticiler</ArrowLink>
        </Reveal>
      </div>
    </section>
  );
}
