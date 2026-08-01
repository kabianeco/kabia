import { manifesto } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";

export function BrandManifesto() {
  return (
    <section
      aria-labelledby="manifesto-heading"
      className="border-t border-ink/10"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-36">
        <div className="grid gap-10 md:grid-cols-12">
          <Reveal className="md:col-span-8">
            <h2
              id="manifesto-heading"
              className="text-3xl leading-[1.15] tracking-tight md:text-5xl lg:text-[3.4rem]"
            >
              {manifesto.statementA}
              <br />
              <em className="font-serif italic text-ink/80">
                {manifesto.statementB}
              </em>
            </h2>
          </Reveal>
          <Reveal
            delay={0.15}
            className="md:col-span-3 md:col-start-10 md:self-end"
          >
            <p className="max-w-xs text-sm leading-relaxed text-ink/60">
              {manifesto.body}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
