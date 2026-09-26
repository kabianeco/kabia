import { ProducerCard } from "@/components/producers/producer-card";
import type { CardProducer } from "@/components/producers/producer-card";
import { Reveal } from "@/components/motion/reveal";
import { ArrowLink } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSeckiProducers } from "@/lib/producers";
import { producerCollections } from "@/content/producers";
import { isBrandPreview } from "@/lib/brand-preview";
import { routes } from "@/lib/site";

/**
 * The Seçki producers on the homepage — people before products.
 *
 * The same editorial cards as /secki (photo, person, product type, story
 * first and shop second), so the homepage carries the 3000 soul: the story
 * sells, then the product. The Mutfak line stays product-led on its own
 * page; here only the four Seçki producers appear.
 *
 * Reads the database in curated order (single source of truth since
 * convergence); preview keeps the static file. A failed read is a small
 * outage note in place — never a silently missing section — and an empty
 * line hides the section the way BestSellers does.
 *
 * Streaming: the page wraps this in Suspense with ProducersFallback (the
 * curated static rows, byte-identical to the loaded rows post-convergence),
 * so the first HTML — and the H1 — never wait on the producers read.
 */
export async function Producers() {
  let producers: CardProducer[] | "error" = "error";
  if (isBrandPreview()) {
    producers = [...producerCollections.secki];
  } else {
    const result = await fetchSeckiProducers(await createSupabaseServerClient());
    producers = result.status === "ok" ? result.producers : "error";
  }
  return <ProducersStrip producers={producers} />;
}

/** Curated static strip — the Suspense fallback; identical to loaded rows. */
export function ProducersFallback() {
  return <ProducersStrip producers={[...producerCollections.secki]} />;
}

function ProducersStrip({ producers }: { producers: CardProducer[] | "error" }) {
  if (producers !== "error" && producers.length === 0) return null;

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

        {producers === "error" ? (
          <p role="alert" className="mt-16 text-sm text-clay">
            Üreticiler şu anda yüklenemiyor. Lütfen daha sonra yeniden deneyin.
          </p>
        ) : (
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
        )}

        <Reveal className="mt-14 border-t border-ink/10 pt-7">
          <ArrowLink href={routes.producers}>Tüm üreticiler</ArrowLink>
        </Reveal>
      </div>
    </section>
  );
}
