"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const loadFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.domAnimation);

/**
 * MotionRoot whose features arrive as a separate chunk after hydration. For
 * routes that animate only on interaction or below the fold (the product
 * page: gallery swaps, the review form and bars).
 */
export function MotionRootLazy({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
