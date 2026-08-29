import {
  Instrument_Sans,
  Instrument_Serif,
  Manrope,
  DM_Sans,
  Source_Sans_3,
  Fraunces,
  Cormorant_Garamond,
  Lora,
} from "next/font/google";

/**
 * The approved font allowlist, imported statically through `next/font/google`.
 *
 * Every approved font is instantiated exactly once here and the resulting
 * `.variable` classNames are applied to `<html>` in `app/layout.tsx`. Each emits
 * a private CSS variable (`--font-<id>`); the theme engine maps the selected
 * `--font-body` / `--font-display` onto those variables via a server-side
 * allowlist resolver (`lib/theme-engine/fonts.ts`).
 *
 * Important rules enforced by this module:
 *   - No dynamic `next/font` imports (build-time only).
 *   - No runtime Google Fonts stylesheet injection.
 *   - No administrator-supplied CSS `font-family` strings ever reach CSS.
 *   - Every font loads `latin` + `latin-ext` (Turkish glyphs: ç ğ ı İ ö ş ü).
 *   - Only the weights the application actually uses are requested.
 *
 * The body fonts load 400/500/600; the editorial fonts load 400 (and 400
 * italic, where supported) — heavier weights would inflate the bundle without
 * a use case.
 */



export const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: true,
});

export const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

export const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

export const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

export const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

export const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

export const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

export const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

/**
 * Every `.variable` className, joined once. Applied to `<html>` so all nine
 * `--font-*` custom properties exist on the document root. The browser only
 * downloads the `@font-face` files for fonts whose families are actually
 * referenced (i.e., `--font-body` / `--font-display`), so loading all nine
 * definitions costs the network nothing in practice.
 */
export const ALL_FONT_VARIABLES = [
  instrumentSans.variable,
  instrumentSerif.variable,
  manrope.variable,
  dmSans.variable,
  sourceSans3.variable,
  fraunces.variable,
  cormorantGaramond.variable,
  lora.variable,
].join(" ");