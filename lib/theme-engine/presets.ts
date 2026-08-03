import type { DensityLevel, ShapePresetId, ShadowStrength } from "@/lib/theme-engine/types";

/**
 * Preset token definitions — the single source of truth for the three shape
 * presets. These live in code, never in the database. A stored theme row only
 * records the preset *identifier*; the values are resolved here so a preset can
 * be refined centrally without a data migration, and an old row can never
 * diverge from the approved vocabulary.
 *
 * Constraints applied in `schema.ts` constrain override values to a fixed
 * allowlist; preset values themselves are trusted because they are compiled in.
 */

export interface ShapePresetTokens {
  id: ShapePresetId;
  /** Turkish display name. */
  label: string;
  /** One-line character note for the editor. */
  character: string;

  radius: {
    button: number;
    image: number;
    productImage: number;
    card: number;
    input: number;
    dialog: number;
    badge: number;
    navigation: number;
    iconContainer: number;
  };
  border: {
    width: number;
    /** 0–1 multiplier onto `--color-ink`. */
    opacity: number;
    /** 0–1 multiplier for the public header's bottom rule. */
    headerDividerOpacity: number;
  };
  shadow: {
    card: ShadowStrength;
    image: ShadowStrength;
    dialog: ShadowStrength;
    floatingNavigation: ShadowStrength;
  };
  icon: {
    strokeWidth: number;
    sizeScale: "compact" | "balanced" | "large";
  };
  density: {
    interface: DensityLevel;
    sectionSpacing: DensityLevel;
    pageGutter: "compact" | "balanced" | "wide";
  };
}

export const SHAPE_PRESETS: Record<ShapePresetId, ShapePresetTokens> = {
  sharp: {
    id: "sharp",
    label: "Keskin",
    character: "Architectural, editorial, precise.",
    radius: {
      button: 0,
      image: 0,
      productImage: 0,
      card: 0,
      input: 0,
      dialog: 0,
      badge: 0,
      navigation: 0,
      iconContainer: 0,
    },
    border: {
      width: 1,
      opacity: 0.24,
      headerDividerOpacity: 0.18,
    },
    shadow: {
      card: "none",
      image: "none",
      dialog: "subtle",
      floatingNavigation: "subtle",
    },
    icon: { strokeWidth: 1.4, sizeScale: "compact" },
    density: {
      interface: "compact",
      sectionSpacing: "compact",
      pageGutter: "compact",
    },
  },

  balanced: {
    id: "balanced",
    label: "Dengeli",
    character: "Modern, premium, controlled softness.",
    radius: {
      button: 8,
      image: 5,
      productImage: 5,
      card: 10,
      input: 6,
      dialog: 10,
      badge: 8,
      navigation: 6,
      iconContainer: 6,
    },
    border: {
      width: 1,
      opacity: 0.18,
      headerDividerOpacity: 0.1,
    },
    shadow: {
      card: "subtle",
      image: "none",
      dialog: "medium",
      floatingNavigation: "medium",
    },
    icon: { strokeWidth: 1.6, sizeScale: "balanced" },
    density: {
      interface: "balanced",
      sectionSpacing: "balanced",
      pageGutter: "balanced",
    },
  },

  soft: {
    id: "soft",
    label: "Yumuşak",
    character: "Warm, organic, approachable, generous depth.",
    radius: {
      button: 999,
      image: 32,
      productImage: 32,
      card: 16,
      input: 20,
      dialog: 28,
      badge: 999,
      navigation: 20,
      iconContainer: 16,
    },
    border: {
      width: 1,
      opacity: 0.12,
      headerDividerOpacity: 0.08,
    },
    shadow: {
      card: "medium",
      image: "subtle",
      dialog: "strong",
      floatingNavigation: "strong",
    },
    icon: { strokeWidth: 1.75, sizeScale: "large" },
    density: {
      interface: "spacious",
      sectionSpacing: "spacious",
      pageGutter: "wide",
    },
  },
};

export const SHAPE_PRESET_IDS = Object.keys(SHAPE_PRESETS) as ShapePresetId[];

export function getPreset(id: string): ShapePresetTokens {
  return SHAPE_PRESETS[id as ShapePresetId] ?? SHAPE_PRESETS.balanced;
}