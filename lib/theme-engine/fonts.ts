import type { BodyFontId, DisplayFontId } from "@/lib/theme-engine/types";

/**
 * Approved font allowlist and the server-side resolver.
 *
 * The application imports every approved font statically through `next/font`
 * (see `lib/fonts.ts`); each emits a private CSS variable such as
 * `--font-instrument-sans`. The selected body/display fonts are *not* raw CSS
 * strings — only stable identifiers live in Supabase. This resolver maps an
 * identifier to that variable name, and silently falls back to the Kabia
 * Original pair when an identifier is unknown (e.g. a font was removed in a
 * later release and a revision still references it).
 *
 * Turkish glyph support is a precondition for the allowlist: every font here
 * ships a `latin-ext` subset, which covers ç, ğ, ı, İ, ö, ş, ü.
 */

export interface ApprovedFont {
  id: BodyFontId | DisplayFontId;
  /** Human label, shown in the editor and rendered in its own typeface. */
  label: string;
  /** The CSS variable the `next/font` import defines. Always `var(--font-…)`. */
  cssVar: string;
  /** "body" (interface) or "display" (editorial). */
  role: "body" | "display";
}

const FONTS: ApprovedFont[] = [
  { id: "instrument_sans", label: "Instrument Sans", cssVar: "var(--font-instrument-sans)", role: "body" },
  { id: "manrope", label: "Manrope", cssVar: "var(--font-manrope)", role: "body" },
  { id: "dm_sans", label: "DM Sans", cssVar: "var(--font-dm-sans)", role: "body" },
  { id: "source_sans_3", label: "Source Sans 3", cssVar: "var(--font-source-sans-3)", role: "body" },
  { id: "instrument_serif", label: "Instrument Serif", cssVar: "var(--font-instrument-serif)", role: "display" },
  { id: "fraunces", label: "Fraunces", cssVar: "var(--font-fraunces)", role: "display" },
  { id: "cormorant_garamond", label: "Cormorant Garamond", cssVar: "var(--font-cormorant-garamond)", role: "display" },
  { id: "lora", label: "Lora", cssVar: "var(--font-lora)", role: "display" },
];

const BY_ID = new Map(FONTS.map((f) => [f.id, f]));

export const APPROVED_BODY_FONTS = FONTS.filter((f) => f.role === "body");
export const APPROVED_DISPLAY_FONTS = FONTS.filter((f) => f.role === "display");

export const DEFAULT_BODY_FONT_ID: BodyFontId = "instrument_sans";
export const DEFAULT_DISPLAY_FONT_ID: DisplayFontId = "instrument_serif";

export function isApprovedBodyFont(id: string): id is BodyFontId {
  const f = BY_ID.get(id as BodyFontId);
  return f?.role === "body";
}

export function isApprovedDisplayFont(id: string): id is DisplayFontId {
  const f = BY_ID.get(id as DisplayFontId);
  return f?.role === "display";
}

/** Resolve a body font id to its CSS variable, fallback-safe. */
export function resolveBodyFontVar(id: string | undefined): string {
  if (id && isApprovedBodyFont(id)) return BY_ID.get(id)!.cssVar;
  return BY_ID.get(DEFAULT_BODY_FONT_ID)!.cssVar;
}

/** Resolve a display font id to its CSS variable, fallback-safe. */
export function resolveDisplayFontVar(id: string | undefined): string {
  if (id && isApprovedDisplayFont(id)) return BY_ID.get(id)!.cssVar;
  return BY_ID.get(DEFAULT_DISPLAY_FONT_ID)!.cssVar;
}

export function labelForBodyFont(id: string): string {
  return BY_ID.get(id as BodyFontId)?.label ?? "Instrument Sans";
}

export function labelForDisplayFont(id: string): string {
  return BY_ID.get(id as DisplayFontId)?.label ?? "Instrument Serif";
}