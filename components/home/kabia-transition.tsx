"use client";

import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";
import { useTheme } from "@/lib/theme";

/* The panel warms to the page surface so the router swap underneath is
   invisible — which means it has to land on whichever surface is active. */
const SETTLE_COLOR = { light: "#f4f1e8", dark: "#12150f" } as const;

export type VeilPhase = "off" | "enter" | "settle";

interface KabiaTransitionProps {
  phase: VeilPhase;
  word: string;
  announcement: string;
}

/**
 * The brand moment between the intro and the store. A forest panel wipes
 * up from the bottom, the word "kabia" rises letter by letter in serif
 * italic, holds, then the whole panel warms to ivory — so when the router
 * swaps the page underneath, the cut is invisible.
 */
export function KabiaTransition({
  phase,
  word,
  announcement,
}: KabiaTransitionProps) {
  const { resolved } = useTheme();
  if (phase === "off") return null;
  const settling = phase === "settle";

  return (
    <motion.div
      role="status"
      aria-label={announcement}
      className="fixed inset-0 z-[80] flex items-center justify-center"
      initial={{
        clipPath: "inset(100% 0% 0% 0%)",
        backgroundColor: "#0b3f2c",
      }}
      animate={{
        clipPath: "inset(0% 0% 0% 0%)",
        backgroundColor: settling ? SETTLE_COLOR[resolved] : "#0b3f2c",
      }}
      transition={{ duration: settling ? 0.5 : 0.55, ease: EASE }}
    >
      <p
        aria-hidden="true"
        className="flex overflow-hidden pb-[0.12em] font-serif text-[17vw] italic leading-none tracking-tight md:text-[9rem]"
      >
        {word.split("").map((ch, i) => (
          <motion.span
            key={`${ch}-${i}`}
            className="inline-block text-on-brand"
            initial={{ y: "115%", opacity: 1 }}
            animate={
              settling ? { y: "0%", opacity: 0 } : { y: "0%", opacity: 1 }
            }
            transition={
              settling
                ? { duration: 0.32, ease: EASE, delay: i * 0.02 }
                : { duration: 0.7, ease: EASE, delay: 0.3 + i * 0.05 }
            }
          >
            {ch}
          </motion.span>
        ))}
      </p>
      <span className="sr-only">{announcement}</span>
    </motion.div>
  );
}
