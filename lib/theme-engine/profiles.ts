import type { BodyFontId, DisplayFontId, TypographyProfileId } from "@/lib/theme-engine/types";

/**
 * Curated typography profiles. Selecting a profile sets both font roles; the
 * administrator may then adjust body or display independently from the approved
 * allowlist. When the chosen combination no longer matches the selected
 * profile, the editor shows an informational warning but still allows it.
 */

export interface TypographyProfile {
  id: TypographyProfileId;
  label: string;
  character: string;
  fonts: { body: BodyFontId; display: DisplayFontId };
}

export const TYPOGRAPHY_PROFILES: Record<TypographyProfileId, TypographyProfile> = {
  kabia_original: {
    id: "kabia_original",
    label: "Kabia Orijinal",
    character: "Calm, editorial, precise — the current premium identity.",
    fonts: { body: "instrument_sans", display: "instrument_serif" },
  },
  modern_clean: {
    id: "modern_clean",
    label: "Modern Sade",
    character: "Contemporary, clear, slightly more geometric.",
    fonts: { body: "manrope", display: "instrument_serif" },
  },
  warm_editorial: {
    id: "warm_editorial",
    label: "Sıcak Editoryal",
    character: "Literary, warm, traditional without becoming rustic.",
    fonts: { body: "source_sans_3", display: "cormorant_garamond" },
  },
  soft_contemporary: {
    id: "soft_contemporary",
    label: "Yumuşak Çağdaş",
    character: "Friendly, modern, organic.",
    fonts: { body: "dm_sans", display: "fraunces" },
  },
};

export const TYPOGRAPHY_PROFILE_IDS = Object.keys(TYPOGRAPHY_PROFILES) as TypographyProfileId[];

export function getProfile(id: string): TypographyProfile {
  return TYPOGRAPHY_PROFILES[id as TypographyProfileId] ?? TYPOGRAPHY_PROFILES.kabia_original;
}

/** True when the current body/display combination matches the profile's pair. */
export function matchesProfile(
  profileId: string,
  body: string,
  display: string,
): boolean {
  const p = getProfile(profileId);
  return p.fonts.body === body && p.fonts.display === display;
}