import { quote } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";

/** Single brand statement, carried over verbatim from the existing site. */
export function BrandQuote() {
  return (
    <section aria-label="Kabia'dan bir söz">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-36">
        <Reveal as="figure" className="mx-auto max-w-3xl text-center">
          <span
            aria-hidden="true"
            className="font-theme-display text-6xl leading-none text-shell"
          >
            “
          </span>
          <blockquote className="mt-2 font-theme-display text-2xl italic leading-snug md:text-4xl">
            {quote.text}
          </blockquote>
          <figcaption className="mt-8 text-xs text-olive">
            <span className="label">{quote.attribution}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {quote.context}
          </figcaption>
        </Reveal>
      </div>
    </section>
  );
}
