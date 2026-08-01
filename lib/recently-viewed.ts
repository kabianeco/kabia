"use client";

import { useSyncExternalStore } from "react";

/**
 * Recently viewed products, kept as an ordered list of slugs in localStorage.
 *
 * Deliberately device-local rather than a database table: it is a browsing
 * convenience, not account data, so it needs no row, no policy and no write on
 * every product view.
 *
 * Exposed through useSyncExternalStore so the row updates the moment a view is
 * recorded — including from another tab — without an effect writing state.
 */

const STORAGE_KEY = "kabia_recently_viewed";
const LIMIT = 8;

const EMPTY: string[] = [];
const listeners = new Set<() => void>();

// getSnapshot must be referentially stable between reads, so the parsed list is
// cached against the raw string it came from.
let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parse(raw);
  }
  return cachedList;
}

const getServerSnapshot = (): string[] => EMPTY;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Moves `slug` to the front of the list, trimming to the most recent few. */
export function recordProductView(slug: string) {
  if (typeof window === "undefined" || !slug) return;
  try {
    const current = getSnapshot();
    if (current[0] === slug) return;
    const next = [slug, ...current.filter((s) => s !== slug)].slice(0, LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing — history simply is not kept.
    return;
  }
  listeners.forEach((l) => l());
}

export function useRecentlyViewed(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
