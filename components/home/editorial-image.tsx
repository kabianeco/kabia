"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { editorialImage } from "@/content/homepage";

/**
 * Full-bleed still life of the drying harvest — the page's breathing room.
 * The image drifts a few percent against scroll; nothing more.
 */
export function EditorialImage() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <figure ref={ref} className="relative">
      <div className="relative h-[64vh] overflow-hidden rounded-media md:h-[82vh]">
        <motion.div
          className="absolute inset-x-0 -inset-y-[8%]"
          style={reducedMotion ? undefined : { y }}
        >
          <Image
            src={editorialImage.src}
            alt={editorialImage.alt}
            fill
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </div>
      <figcaption className="mx-auto flex max-w-[1200px] gap-3 px-6 py-5 text-xs text-olive md:px-10">
        <span aria-hidden="true">—</span>
        {editorialImage.caption}
      </figcaption>
    </figure>
  );
}
