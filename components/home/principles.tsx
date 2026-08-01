import { principles } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";

export function Principles() {
  return (
    <section
      id="yaklasim"
      aria-labelledby="principles-heading"
      className="scroll-mt-20"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <Reveal>
          <h2 id="principles-heading" className="label text-olive">
            {principles.title}
          </h2>
        </Reveal>
        <ol className="mt-10">
          {principles.items.map((item, index) => (
            <Reveal
              as="li"
              key={item.name}
              delay={index * 0.08}
              className="grid gap-4 border-t border-ink/10 py-10 md:grid-cols-12 md:items-baseline md:py-14"
            >
              <span
                aria-hidden="true"
                className="font-serif text-xl text-shell md:col-span-1"
              >
                0{index + 1}
              </span>
              <h3 className="font-serif text-3xl italic tracking-tight md:col-span-5 md:text-4xl">
                {item.name}
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-ink/60 md:col-span-5 md:col-start-8 md:text-base">
                {item.description}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
