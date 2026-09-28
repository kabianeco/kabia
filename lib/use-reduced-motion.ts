"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (notify: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/**
 * The visitor's reduced-motion preference. False on the server and during
 * hydration (so the first client render matches the markup), then live.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
