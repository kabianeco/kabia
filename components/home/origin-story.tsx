import Image from "next/image";
import { origin } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";

/**
 * Documentary farm section: sticky editorial text beside a slow column of
 * captioned photographs from the Geyve orchards.
 */
export function OriginStory() {
  return (
    <section
      id="ciftlik"
      aria-labelledby="origin-heading"
      className="scroll-mt-20"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="md:sticky md:top-32">
              <Reveal>
                <p className="label text-olive">{origin.eyebrow}</p>
                <h2
                  id="origin-heading"
                  className="mt-5 text-3xl tracking-tight md:text-4xl"
                >
                  {origin.title}
                </h2>
                {origin.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    className="mt-5 max-w-sm text-sm leading-relaxed text-ink/65 md:text-base"
                  >
                    {paragraph}
                  </p>
                ))}
              </Reveal>
            </div>
          </div>

          <div className="space-y-16 md:col-span-6 md:col-start-7">
            {origin.images.map((image, index) => (
              <Reveal as="figure" key={image.src}>
                <div
                  className={`relative overflow-hidden rounded-media ${
                    index === 1 ? "aspect-[3/4] md:mr-16" : "aspect-[4/3]"
                  }`}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 768px) 45vw, 100vw"
                    loading="lazy"
                    decoding="async"
                    className="object-cover"
                  />
                </div>
                <figcaption className="mt-3 flex gap-3 text-xs text-olive">
                  <span aria-hidden="true">—</span>
                  {image.caption}
                </figcaption>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
