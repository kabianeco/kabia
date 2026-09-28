"use client";

import { LazyMotion, MotionConfig, domMax } from "framer-motion";
import type { ReactNode } from "react";

/** MotionRoot with layout animations (the cart rows reflow as lines change). */
export function MotionRootMax({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
