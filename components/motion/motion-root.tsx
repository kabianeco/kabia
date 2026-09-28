"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Framer Motion lives only on the routes that animate (home, product, cart,
 * checkout); every other route ships none of it. Each such route wraps its
 * animated content in one of these roots. This one carries the animation
 * features with the route itself, for pages whose first frame is animated.
 * reducedMotion="user" is the same boundary the root provider used to set.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
