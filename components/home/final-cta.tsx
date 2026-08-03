import Image from "next/image";
import { finalCta } from "@/content/homepage";
import { site } from "@/lib/site";
import { Reveal } from "@/components/motion/reveal";

/** Closing conversion moment doubling as the contact section. */
export function FinalCta() {
  return (
    <section
      id="iletisim"
      aria-labelledby="contact-heading"
      className="on-dark scroll-mt-20 bg-forest text-cream"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid items-center gap-14 md:grid-cols-12">
          <Reveal className="md:col-span-6">
            <h2
              id="contact-heading"
              className="text-3xl leading-[1.12] tracking-tight md:text-5xl"
            >
              {finalCta.titleA}
              <br />
              <em className="font-theme-display italic text-shell">{finalCta.titleB}</em>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-cream/65 md:text-base">
              {finalCta.body}
            </p>
            <a
              href={finalCta.cta.href}
              className="mt-9 inline-block rounded-theme-button bg-cream px-8 py-4 text-sm font-medium text-forest transition-colors duration-300 hover:bg-ivory"
            >
              {finalCta.cta.label}
            </a>
            <address className="mt-12 space-y-2 text-sm not-italic text-cream/60">
              <p>{site.address}</p>
              <p>
                <a
                  href={site.phoneHref}
                  className="transition-colors duration-300 hover:text-cream"
                >
                  {site.phone}
                </a>
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                <a
                  href={`mailto:${site.email}`}
                  className="transition-colors duration-300 hover:text-cream"
                >
                  {site.email}
                </a>
              </p>
            </address>
          </Reveal>

          <Reveal delay={0.12} className="md:col-span-5 md:col-start-8">
            <div className="relative aspect-[4/5] overflow-hidden rounded-media border border-cream/15">
              <Image
                src={finalCta.image.src}
                alt={finalCta.image.alt}
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
