import { z } from "zod";
import { SHAPE_PRESET_IDS } from "@/lib/theme-engine/presets";
import { TYPOGRAPHY_PROFILES, getProfile } from "@/lib/theme-engine/profiles";
import {
  APPROVED_BODY_FONTS,
  APPROVED_DISPLAY_FONTS,
  DEFAULT_BODY_FONT_ID as DEFAULT_BODY,
  DEFAULT_DISPLAY_FONT_ID as DEFAULT_DISPLAY,
} from "@/lib/theme-engine/fonts";
import type { ThemeConfiguration, TypographyProfileId } from "@/lib/theme-engine/types";

/**
 * Zod validation for the persisted theme configuration. Nothing from Supabase
 * is ever trusted unvalidated. Approved identifiers are enumerated; numeric
 * tokens are constrained to the spec's allowlists; unknown keys are stripped.
 */

export const CURRENT_SCHEMA_VERSION = 1;

const radiusValues = [0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 999] as const;
const borderWidths = [0, 1, 2] as const;
const borderOpacities = [0.08, 0.12, 0.18, 0.24, 0.32] as const;
const iconStrokes = [1.25, 1.4, 1.5, 1.6, 1.75, 2] as const;
const shadowStrengths = ["none", "subtle", "medium", "strong"] as const;
const densityLevels = ["compact", "balanced", "spacious"] as const;
const gutters = ["compact", "balanced", "wide"] as const;
const iconScales = ["compact", "balanced", "large"] as const;
const stockBadgeTones = ["clay", "ink", "brand", "olive", "shell"] as const;
const stockBadgeFills = ["solid", "outline", "text"] as const;
const stockBadgePositions = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
const stockBadgeInsets = [0, 2, 4, 8, 12, 16] as const;
const stockBadgeInsetHas = (v: number) => (stockBadgeInsets as readonly number[]).includes(v);

const radiusHas = (v: number) => (radiusValues as readonly number[]).includes(v);
const borderWidthHas = (v: number) => (borderWidths as readonly number[]).includes(v);
const borderOpacityHas = (v: number) => (borderOpacities as readonly number[]).includes(v);
const iconStrokeHas = (v: number) => (iconStrokes as readonly number[]).includes(v);

const numField = (label: string, check: (v: number) => boolean) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? Number(v) : v))
    .refine((v) => Number.isFinite(v) && check(v), { message: `Geçersiz ${label}.` })
    .optional();

const optionalEnum = <T extends readonly string[]>(values: T) =>
  z
    .string()
    .refine((v) => (values as readonly string[]).includes(v), { message: "Geçersiz değer." })
    .optional();

export const themeOverridesSchema = z
  .object({
    radius: z
      .object({
        button: numField("yarıçap", radiusHas),
        image: numField("yarıçap", radiusHas),
        productImage: numField("yarıçap", radiusHas),
        card: numField("yarıçap", radiusHas),
        input: numField("yarıçap", radiusHas),
        dialog: numField("yarıçap", radiusHas),
        badge: numField("yarıçap", radiusHas),
        navigation: numField("yarıçap", radiusHas),
        iconContainer: numField("yarıçap", radiusHas),
      })
      .strict()
      .optional(),
    border: z
      .object({
        width: numField("kenarlık", borderWidthHas),
        opacity: numField("opaklık", borderOpacityHas),
        headerDividerOpacity: numField("opaklık", borderOpacityHas),
      })
      .strict()
      .optional(),
    shadow: z
      .object({
        card: optionalEnum(shadowStrengths),
        image: optionalEnum(shadowStrengths),
        dialog: optionalEnum(shadowStrengths),
        floatingNavigation: optionalEnum(shadowStrengths),
      })
      .strict()
      .optional(),
    icon: z
      .object({
        strokeWidth: numField("ikon kalınlığı", iconStrokeHas),
        sizeScale: optionalEnum(iconScales),
      })
      .strict()
      .optional(),
    density: z
      .object({
        interface: optionalEnum(densityLevels),
        sectionSpacing: optionalEnum(densityLevels),
        pageGutter: optionalEnum(gutters),
      })
      .strict()
      .optional(),
    stockBadge: z
      .object({
        visible: z.boolean().optional(),
        tone: optionalEnum(stockBadgeTones),
        fill: optionalEnum(stockBadgeFills),
        position: optionalEnum(stockBadgePositions),
        inset: numField("kenar boşluğu", stockBadgeInsetHas),
        radius: numField("yarıçap", radiusHas),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional()
  .default({});

const bodyFontIds = APPROVED_BODY_FONTS.map((f) => f.id) as [string, ...string[]];
const displayFontIds = APPROVED_DISPLAY_FONTS.map((f) => f.id) as [string, ...string[]];

export const themeConfigSchema = z.object({
  schemaVersion: z.number().int().min(1).max(99).default(CURRENT_SCHEMA_VERSION),
  shapePreset: z.enum(SHAPE_PRESET_IDS).default("balanced"),
  typographyProfile: z
    .enum(Object.keys(TYPOGRAPHY_PROFILES) as [string, ...string[]])
    .default("kabia_original")
    .transform((v) => v as TypographyProfileId),
  fonts: z
    .object({
      body: z
        .enum(bodyFontIds)
        .refine((v) => APPROVED_BODY_FONTS.some((f) => f.id === v), { message: "Bilinmeyen gövde fontu." })
        .default(DEFAULT_BODY)
        .transform((v) => v as typeof DEFAULT_BODY),
      display: z
        .enum(displayFontIds)
        .refine((v) => APPROVED_DISPLAY_FONTS.some((f) => f.id === v), { message: "Bilinmeyen editoryal fontu." })
        .default(DEFAULT_DISPLAY)
        .transform((v) => v as typeof DEFAULT_DISPLAY),
    })
    .default({ body: DEFAULT_BODY, display: DEFAULT_DISPLAY }),
  overrides: themeOverridesSchema,
});

export type ThemeConfigInput = z.input<typeof themeConfigSchema>;
export type ThemeConfigParsed = z.output<typeof themeConfigSchema>;

/**
 * Parse unknown JSON into a valid `ThemeConfiguration`, or return null.
 *
 * If `fonts` is absent but `typographyProfile` is present, the fonts are
 * derived from the profile, so older rows that only carried the profile remain
 * coherent.
 */
export function parseThemeConfig(raw: unknown): ThemeConfiguration | null {
  if (raw == null || typeof raw !== "object") return null;
  try {
    const input = raw as Record<string, unknown>;
    if (
      input.fonts == null &&
      typeof input.typographyProfile === "string" &&
      input.typographyProfile in TYPOGRAPHY_PROFILES
    ) {
      const p = getProfile(input.typographyProfile);
      input.fonts = { ...p.fonts };
    }
    const parsed = themeConfigSchema.parse(input);
    return {
      schemaVersion: parsed.schemaVersion,
      shapePreset: parsed.shapePreset,
      typographyProfile: parsed.typographyProfile,
      fonts: { body: parsed.fonts.body, display: parsed.fonts.display },
      overrides: (parsed.overrides ?? {}) as ThemeConfiguration["overrides"],
    };
  } catch {
    return null;
  }
}

/** True when the input parses cleanly — used by RPC pre-checks. */
export function isValidThemeConfig(raw: unknown): boolean {
  return parseThemeConfig(raw) !== null;
}