/**
 * Controlled theme configuration types.
 *
 * A theme configuration is the only shape ever stored in Supabase for the
 * appearance engine. It is intentionally compact: preset/profile/font
 * identifiers plus a flat `overrides` object. Complete preset definitions live
 * in `lib/theme-engine/presets.ts` (version-controlled code), never in the
 * database — so a preset can be tuned centrally without a data migration and
 * a stored row can never drift from the approved vocabulary.
 *
 * Nothing here is a CSS string. No font URLs, no raw `font-family` values, no
 * arbitrary radii. Only approved identifiers and constrained numbers/enums.
 */

export type ShapePresetId = "sharp" | "balanced" | "soft";

/** Stable identifiers for the four approved body/interface fonts. */
export type BodyFontId =
  | "instrument_sans"
  | "manrope"
  | "dm_sans"
  | "source_sans_3";

/** Stable identifiers for the four approved editorial/display fonts. */
export type DisplayFontId =
  | "instrument_serif"
  | "fraunces"
  | "cormorant_garamond"
  | "lora";

/** Approved typography profile identifiers. */
export type TypographyProfileId =
  | "kabia_original"
  | "modern_clean"
  | "warm_editorial"
  | "soft_contemporary";

export type DensityLevel = "compact" | "balanced" | "spacious";
export type PageSizeGutter = "compact" | "balanced" | "wide";
export type IconSizeScale = "compact" | "balanced" | "large";

export type ShadowStrength = "none" | "subtle" | "medium" | "strong";

/** A draft override is always optional; `undefined` means "use the preset". */
export interface ThemeOverrides {
  radius?: {
    button?: number;
    image?: number;
    productImage?: number;
    card?: number;
    input?: number;
    dialog?: number;
    badge?: number;
    navigation?: number;
    iconContainer?: number;
  };
  border?: {
    width?: number;
    opacity?: number;
    headerDividerOpacity?: number;
  };
  shadow?: {
    card?: ShadowStrength;
    image?: ShadowStrength;
    dialog?: ShadowStrength;
    floatingNavigation?: ShadowStrength;
  };
  icon?: {
    strokeWidth?: number;
    sizeScale?: IconSizeScale;
  };
  density?: {
    interface?: DensityLevel;
    sectionSpacing?: DensityLevel;
    pageGutter?: PageSizeGutter;
  };
}

/** The persisted shape. Schema-versioned for forward migration. */
export interface ThemeConfiguration {
  schemaVersion: number;
  shapePreset: ShapePresetId;
  typographyProfile: TypographyProfileId;
  fonts: {
    body: BodyFontId;
    display: DisplayFontId;
  };
  overrides: ThemeOverrides;
}

/** The default configuration — reproduces the current Kabia site. */
export const DEFAULT_THEME_CONFIG: ThemeConfiguration = {
  schemaVersion: 1,
  shapePreset: "balanced",
  typographyProfile: "kabia_original",
  fonts: {
    body: "instrument_sans",
    display: "instrument_serif",
  },
  overrides: {},
};

/** The singleton key used by `site_theme_settings` and `site_theme_revisions`. */
export const SITE_THEME_KEY = "default";

/** Cache tag for the published theme. Mirrors `SETTINGS_TAG`. */
export const SITE_THEME_TAG = "site-theme";