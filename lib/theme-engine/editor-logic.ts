import { getProfile } from "@/lib/theme-engine/profiles"
import type {
  BodyFontId,
  DisplayFontId,
  ShapePresetId,
  ThemeConfiguration,
  ThemeOverrides,
  TypographyProfileId,
} from "@/lib/theme-engine/types"

/**
 * Pure configuration transforms used by the appearance editor's local state.
 *
 * Extracted so the editor's behavior is unit-testable without a DOM: every
 * transform is a pure function of the working config. The editor component
 * delegates to these so its logic and the tests cannot drift apart.
 *
 * Selecting a preset clears overrides (they were relative to the old preset);
 * selecting a typography profile sets both font roles; an override merge keeps
 * the other overrides in the same group intact.
 */

export function selectPreset(config: ThemeConfiguration, id: ShapePresetId): ThemeConfiguration {
  if (id === config.shapePreset) return config
  return { ...config, shapePreset: id, overrides: {} }
}

export function selectProfile(config: ThemeConfiguration, id: TypographyProfileId): ThemeConfiguration {
  const p = getProfile(id)
  return { ...config, typographyProfile: id, fonts: { ...p.fonts } }
}

export function setBodyFont(config: ThemeConfiguration, id: BodyFontId): ThemeConfiguration {
  return { ...config, fonts: { ...config.fonts, body: id } }
}

export function setDisplayFont(config: ThemeConfiguration, id: DisplayFontId): ThemeConfiguration {
  return { ...config, fonts: { ...config.fonts, display: id } }
}

export function applyOverride(
  config: ThemeConfiguration,
  group: keyof ThemeOverrides,
  key: string,
  value: unknown,
): ThemeConfiguration {
  const groupObj = (config.overrides[group] ?? {}) as Record<string, unknown>
  const nextGroup = { ...groupObj, [key]: value }
  return { ...config, overrides: { ...config.overrides, [group]: nextGroup } as ThemeOverrides }
}

export function resetGroup(config: ThemeConfiguration, group: keyof ThemeOverrides): ThemeConfiguration {
  const next = { ...config.overrides }
  delete next[group]
  return { ...config, overrides: next }
}

export function resetOverrides(config: ThemeConfiguration): ThemeConfiguration {
  return { ...config, overrides: {} }
}

/** True when the working config differs from the saved draft/published. */
export function isDirty(working: ThemeConfiguration, saved: ThemeConfiguration): boolean {
  return JSON.stringify(working) !== JSON.stringify(saved)
}