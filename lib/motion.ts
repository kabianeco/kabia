/**
 * Shared motion vocabulary. Components should use these tokens instead of
 * ad-hoc durations so the whole page moves with one voice.
 * CSS equivalents live in app/globals.css (@theme).
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  fast: 0.3,
  base: 0.6,
  slow: 0.9,
} as const;

export const fadeRise = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: DURATION.base, ease: EASE },
} as const;
