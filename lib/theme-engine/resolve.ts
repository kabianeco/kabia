import { getPreset, type ShapePresetTokens } from "@/lib/theme-engine/presets";
import { resolveBodyFontVar, resolveDisplayFontVar } from "@/lib/theme-engine/fonts";
import { parseThemeConfig } from "@/lib/theme-engine/schema";
import {
  DEFAULT_THEME_CONFIG,
  type DensityLevel,
  type ShadowStrength,
  type StockBadgeFill,
  type StockBadgePosition,
  type StockBadgeTone,
  type ThemeConfiguration,
} from "@/lib/theme-engine/types";

/**
 * The resolver. Combines:
 *   base tokens (compiled in)
 * + selected shape preset       (compiled in)
 * + selected typography profile  (compensates a custom body/display combo)
 * + validated overrides
 *
 * The output is a flat map of semantic CSS variables ready to stamp on
 * `:root`. The caller (`<ThemeVars>`) renders them into an SSR `<style>` so the
 * first paint already has the right values — no flash, no `useEffect`.
 *
 * Unknown preset/font identifiers fall back to the Kabia Original defaults, so
 * a removed font or an old schema row never breaks the public site.
 */

export interface ResolvedTheme {
  config: ThemeConfiguration;
  /** Semantic CSS variables. Values are CSS strings (e.g. "5px", "var(--font-…)"). */
  vars: Record<string, string>;
  preset: ShapePresetTokens;
}

const DENSITY_HEIGHTS: Record<DensityLevel, { sm: number; md: number }> = {
  compact: { sm: 40, md: 44 },
  balanced: { sm: 44, md: 48 },
  spacious: { sm: 48, md: 56 },
};

const DENSITY_CARD_PADDING: Record<DensityLevel, string> = {
  compact: "1rem",
  balanced: "1.5rem",
  spacious: "2rem",
};

const DENSITY_PRODUCT_SPACING: Record<DensityLevel, string> = {
  compact: "0.75rem",
  balanced: "1.25rem",
  spacious: "1.75rem",
};

const DENSITY_TABLE_ROW: Record<DensityLevel, string> = {
  compact: "0.5rem 0.75rem",
  balanced: "0.75rem 1rem",
  spacious: "1rem 1.25rem",
};

const SECTION_SPACING: Record<DensityLevel, string> = {
  compact: "4rem",
  balanced: "6rem",
  spacious: "8rem",
};

const PAGE_GUTTER: Record<"compact" | "balanced" | "wide", string> = {
  compact: "1rem",
  balanced: "1.5rem",
  wide: "2rem",
};

const ICON_SIZE: Record<"compact" | "balanced" | "large", { sm: number; md: number; lg: number }> = {
  compact: { sm: 14, md: 16, lg: 20 },
  balanced: { sm: 16, md: 18, lg: 22 },
  large: { sm: 18, md: 20, lg: 24 },
};

const SHADOW_VALUE: Record<ShadowStrength, string> = {
  none: "none",
  subtle: "0 1px 2px 0 color-mix(in srgb, var(--color-ink) 8%, transparent)",
  medium: "0 4px 12px -2px color-mix(in srgb, var(--color-ink) 12%, transparent)",
  strong: "0 12px 32px -6px color-mix(in srgb, var(--color-ink) 16%, transparent)",
};

/** The badge has no preset variation — one fixed default set, purely override-driven. */
const STOCK_BADGE_DEFAULTS = {
  visible: true,
  tone: "clay" as StockBadgeTone,
  fill: "solid" as StockBadgeFill,
  position: "top-left" as StockBadgePosition,
  inset: 8,
  radius: 0,
};

const STOCK_BADGE_TONE_VAR: Record<StockBadgeTone, string> = {
  clay: "var(--color-clay)",
  ink: "var(--color-ink)",
  brand: "var(--color-brand)",
  olive: "var(--color-olive)",
  shell: "var(--color-shell)",
};

const STOCK_BADGE_FILL_STYLE: Record<StockBadgeFill, { bg: string; border: string }> = {
  solid: { bg: "color-mix(in srgb, var(--color-ivory) 95%, transparent)", border: "none" },
  outline: { bg: "transparent", border: "1px solid currentColor" },
  text: { bg: "transparent", border: "none" },
};

/** Which two sides carry the inset for a given corner; the other two are "auto". */
function stockBadgeSides(
  position: StockBadgePosition,
  inset: number,
): { top: string; right: string; bottom: string; left: string } {
  const px = `${inset}px`;
  switch (position) {
    case "top-left":
      return { top: px, left: px, right: "auto", bottom: "auto" };
    case "top-right":
      return { top: px, right: px, left: "auto", bottom: "auto" };
    case "bottom-left":
      return { bottom: px, left: px, top: "auto", right: "auto" };
    case "bottom-right":
      return { bottom: px, right: px, top: "auto", left: "auto" };
  }
}

/** Border opacity (0–1) → CSS `border-color` using the ink color. */
function borderCol(opacity: number): string {
  return `color-mix(in srgb, var(--color-ink) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Resolve a stored configuration into semantic CSS variables.
 *
 * `raw` is whatever came back from Supabase (or localStorage in the admin
 * preview). It is validated before it reaches the resolver; if it fails, the
 * caller falls back to `DEFAULT_THEME_CONFIG` — never to the resolver with
 * untrusted input.
 */
export function resolveTheme(config: ThemeConfiguration): ResolvedTheme {
  const preset = getPreset(config.shapePreset);
  const ov = config.overrides ?? {};

  // Apply overrides — every field is optional and constrained by the schema.
  const radius = {
    button: ov.radius?.button ?? preset.radius.button,
    image: ov.radius?.image ?? preset.radius.image,
    productImage: ov.radius?.productImage ?? preset.radius.productImage,
    card: ov.radius?.card ?? preset.radius.card,
    input: ov.radius?.input ?? preset.radius.input,
    dialog: ov.radius?.dialog ?? preset.radius.dialog,
    badge: ov.radius?.badge ?? preset.radius.badge,
    navigation: ov.radius?.navigation ?? preset.radius.navigation,
    iconContainer: ov.radius?.iconContainer ?? preset.radius.iconContainer,
  };
  const border = {
    width: ov.border?.width ?? preset.border.width,
    opacity: ov.border?.opacity ?? preset.border.opacity,
    headerDividerOpacity: ov.border?.headerDividerOpacity ?? preset.border.headerDividerOpacity,
  };
  const shadow = {
    card: ov.shadow?.card ?? preset.shadow.card,
    image: ov.shadow?.image ?? preset.shadow.image,
    dialog: ov.shadow?.dialog ?? preset.shadow.dialog,
    floatingNavigation: ov.shadow?.floatingNavigation ?? preset.shadow.floatingNavigation,
  };
  const icon = {
    strokeWidth: ov.icon?.strokeWidth ?? preset.icon.strokeWidth,
    sizeScale: ov.icon?.sizeScale ?? preset.icon.sizeScale,
  };
  const density = {
    interface: ov.density?.interface ?? preset.density.interface,
    sectionSpacing: ov.density?.sectionSpacing ?? preset.density.sectionSpacing,
    pageGutter: ov.density?.pageGutter ?? preset.density.pageGutter,
  };

  const heights = DENSITY_HEIGHTS[density.interface];
  const icons = ICON_SIZE[icon.sizeScale];

  const stockBadge = {
    visible: ov.stockBadge?.visible ?? STOCK_BADGE_DEFAULTS.visible,
    tone: ov.stockBadge?.tone ?? STOCK_BADGE_DEFAULTS.tone,
    fill: ov.stockBadge?.fill ?? STOCK_BADGE_DEFAULTS.fill,
    position: ov.stockBadge?.position ?? STOCK_BADGE_DEFAULTS.position,
    inset: ov.stockBadge?.inset ?? STOCK_BADGE_DEFAULTS.inset,
    radius: ov.stockBadge?.radius ?? STOCK_BADGE_DEFAULTS.radius,
  };
  const stockBadgeSidesResolved = stockBadgeSides(stockBadge.position, stockBadge.inset);
  const stockBadgeFillResolved = STOCK_BADGE_FILL_STYLE[stockBadge.fill];

  const vars: Record<string, string> = {
    // Component radii
    "--theme-radius-button": `${radius.button}px`,
    "--theme-radius-image": `${radius.image}px`,
    "--theme-radius-product-image": `${radius.productImage}px`,
    "--theme-radius-card": `${radius.card}px`,
    "--theme-radius-input": `${radius.input}px`,
    "--theme-radius-dialog": `${radius.dialog}px`,
    "--theme-radius-badge": `${radius.badge}px`,
    "--theme-radius-navigation": `${radius.navigation}px`,
    "--theme-radius-icon-container": `${radius.iconContainer}px`,

    // Borders
    "--theme-border-width": `${border.width}px`,
    "--theme-border-opacity-string": `${borderCol(border.opacity)}`,
    "--theme-border-color": `var(--theme-border-opacity-string)`,
    "--theme-header-divider-opacity": `${borderCol(border.headerDividerOpacity)}`,

    // Shadows
    "--theme-shadow-card": SHADOW_VALUE[shadow.card],
    "--theme-shadow-image": SHADOW_VALUE[shadow.image],
    "--theme-shadow-dialog": SHADOW_VALUE[shadow.dialog],
    "--theme-shadow-floating-navigation": SHADOW_VALUE[shadow.floatingNavigation],

    // Icons
    "--theme-icon-stroke-width": `${icon.strokeWidth}`,
    "--theme-icon-size-sm": `${icons.sm}px`,
    "--theme-icon-size-md": `${icons.md}px`,
    "--theme-icon-size-lg": `${icons.lg}px`,

    // Control heights + paddings
    "--theme-control-height-sm": `${heights.sm}px`,
    "--theme-control-height-md": `${heights.md}px`,
    "--theme-card-padding": DENSITY_CARD_PADDING[density.interface],
    "--theme-product-card-spacing": DENSITY_PRODUCT_SPACING[density.interface],
    "--theme-table-row-density": DENSITY_TABLE_ROW[density.interface],
    "--theme-page-gutter": PAGE_GUTTER[density.pageGutter],
    "--theme-section-spacing": SECTION_SPACING[density.sectionSpacing],

    // Fonts (map selected ids → approved CSS variables, fallback-safe)
    "--font-body": resolveBodyFontVar(config.fonts.body),
    "--font-display": resolveDisplayFontVar(config.fonts.display),

    // Out-of-stock badge
    "--theme-stock-badge-display": stockBadge.visible ? "inline-block" : "none",
    "--theme-stock-badge-color": STOCK_BADGE_TONE_VAR[stockBadge.tone],
    "--theme-stock-badge-bg": stockBadgeFillResolved.bg,
    "--theme-stock-badge-border": stockBadgeFillResolved.border,
    "--theme-stock-badge-radius": `${stockBadge.radius}px`,
    "--theme-stock-badge-top": stockBadgeSidesResolved.top,
    "--theme-stock-badge-right": stockBadgeSidesResolved.right,
    "--theme-stock-badge-bottom": stockBadgeSidesResolved.bottom,
    "--theme-stock-badge-left": stockBadgeSidesResolved.left,
  };

  return { config, vars, preset };
}

/**
 * Resolve raw JSON from the database. Validates first; on any failure returns
 * the default balanced + Kabia Original theme. The caller never sees a broken
 * theme — and never caches one — so a corrupt row or a Supabase hiccup degrades
 * gracefully rather than painting an unstyled site.
 */
export function resolveThemeSafe(raw: unknown): ResolvedTheme {
  const config = parseThemeConfig(raw);
  return resolveTheme(config ?? DEFAULT_THEME_CONFIG);
}

/** Convenience for the default balanced theme. */
export function resolveDefaultTheme(): ResolvedTheme {
  return resolveTheme(DEFAULT_THEME_CONFIG);
}

/** Serialize the resolved vars into a `:root { … }` CSS block. */
export function varsToCss(vars: Record<string, string>, selector = ":root"): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n  ");
  return `${selector} {\n  ${body}\n}`;
}