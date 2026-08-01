"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import { process } from "@/content/homepage";
import { Reveal } from "@/components/motion/reveal";

/**
 * The dark passage of the page: six steps from orchard to table along a
 * single vertical line that draws itself as the reader scrolls. With
 * reduced motion the line is simply complete.
 */
export function ProcessStory() {
  const listRef = useRef<HTMLOListElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.75", "end 0.6"],
  });

  return (
    <section
      aria-labelledby="process-heading"
      className="on-dark bg-forest text-cream"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-6">
            <h2
              id="process-heading"
              className="text-3xl tracking-tight md:text-4xl"
            >
              {process.title}
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-4 md:col-start-9">
            <p className="text-sm leading-relaxed text-cream/60">
              {process.intro}
            </p>
          </Reveal>
        </div>

        <div className="relative mt-16 md:mt-20">
          {/* Track and scroll-drawn progress line */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-[7px] top-0 w-px bg-cream/15 md:left-[9px]"
          />
          <motion.div
            aria-hidden="true"
            className="absolute bottom-0 left-[7px] top-0 w-px origin-top bg-shell md:left-[9px]"
            style={reducedMotion ? undefined : { scaleY: scrollYProgress }}
          />

          <ol ref={listRef}>
            {process.steps.map((step, index) => (
              <Reveal
                as="li"
                key={step.name}
                className="relative grid gap-2 py-8 pl-10 md:grid-cols-12 md:gap-8 md:py-10 md:pl-14"
              >
                {/* Node on the line */}
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[2.4rem] h-[15px] w-[15px] rounded-full border border-cream/40 bg-forest md:left-0 md:h-[19px] md:w-[19px]"
                />
                <span className="font-serif text-lg text-cream/40 md:col-span-1">
                  0{index + 1}
                </span>
                <h3 className="text-2xl tracking-tight md:col-span-3">
                  {step.name}
                </h3>
                <p className="max-w-md text-sm leading-relaxed text-cream/65 md:col-span-6 md:col-start-6">
                  {step.description}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
