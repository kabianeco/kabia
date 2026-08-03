/**
 * Appearance editor — local state behavior.
 *
 * The editor's interactive logic (preset/profile/font selection, override
 * merging, reset, dirty detection) lives in `lib/theme-engine/editor-logic.ts`
 * as pure functions so it can be unit-tested without a DOM. This module
 * exercises those pure transforms — the same ones the React component delegates
 * to — so the editor's behavior and the tests cannot drift apart.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  selectPreset,
  selectProfile,
  setBodyFont,
  setDisplayFont,
  applyOverride,
  resetGroup,
  resetOverrides,
  isDirty,
} from "../lib/theme-engine/editor-logic.ts"
import { DEFAULT_THEME_CONFIG } from "../lib/theme-engine/types.ts"

const base = () => ({ ...DEFAULT_THEME_CONFIG, overrides: {} })

describe("editor: preset selection", () => {
  it("switching the preset clears overrides (they were relative to the old preset)", () => {
    const withOverride = applyOverride(base(), "radius", "button", 2)
    const next = selectPreset(withOverride, "soft")
    assert.equal(next.shapePreset, "soft")
    assert.deepEqual(next.overrides, {}, "overrides must reset on preset switch")
  })

  it("selecting the current preset is a no-op", () => {
    const b = base()
    assert.equal(selectPreset(b, "balanced"), b)
  })
})

describe("editor: typography profile & font selection", () => {
  it("selecting a profile sets both font roles", () => {
    const next = selectProfile(base(), "soft_contemporary")
    assert.equal(next.typographyProfile, "soft_contemporary")
    assert.equal(next.fonts.body, "dm_sans")
    assert.equal(next.fonts.display, "fraunces")
  })

  it("body font can be adjusted independently of the profile", () => {
    let c = selectProfile(base(), "soft_contemporary")
    c = setBodyFont(c, "manrope")
    assert.equal(c.fonts.body, "manrope")
    assert.equal(c.fonts.display, "fraunces")
    assert.equal(c.typographyProfile, "soft_contemporary", "profile id is retained")
  })

  it("display font can be adjusted independently", () => {
    let c = selectProfile(base(), "modern_clean")
    c = setDisplayFont(c, "lora")
    assert.equal(c.fonts.display, "lora")
    assert.equal(c.fonts.body, "manrope")
  })
})

describe("editor: override merging", () => {
  it("applyOverride keeps other overrides in the same group", () => {
    let c = applyOverride(base(), "radius", "button", 2)
    c = applyOverride(c, "radius", "card", 4)
    assert.equal(c.overrides.radius?.button, 2)
    assert.equal(c.overrides.radius?.card, 4)
  })

  it("applyOverride keeps other groups intact", () => {
    let c = applyOverride(base(), "radius", "button", 2)
    c = applyOverride(c, "border", "opacity", 0.24)
    assert.equal(c.overrides.radius?.button, 2)
    assert.equal(c.overrides.border?.opacity, 0.24)
  })

  it("resetGroup clears one group only", () => {
    let c = applyOverride(base(), "radius", "button", 2)
    c = applyOverride(c, "border", "opacity", 0.24)
    c = resetGroup(c, "radius")
    assert.deepEqual(c.overrides.radius, undefined)
    assert.equal(c.overrides.border?.opacity, 0.24)
  })

  it("resetOverrides clears everything back to the pure preset", () => {
    let c = applyOverride(base(), "radius", "button", 2)
    c = applyOverride(c, "icon", "strokeWidth", 1.4)
    c = resetOverrides(c)
    assert.deepEqual(c.overrides, {})
  })
})

describe("editor: dirty detection", () => {
  it("a fresh working config matches the saved draft (not dirty)", () => {
    const b = base()
    assert.equal(isDirty(b, b), false)
  })

  it("an override change is dirty", () => {
    const saved = base()
    const working = applyOverride(saved, "radius", "button", 2)
    assert.equal(isDirty(working, saved), true)
  })

  it("a font change is dirty", () => {
    const saved = base()
    const working = setBodyFont(saved, "manrope")
    assert.equal(isDirty(working, saved), true)
  })

  it("a preset change is dirty", () => {
    const saved = base()
    const working = selectPreset(saved, "sharp")
    assert.equal(isDirty(working, saved), true)
  })

  it("reverting back to the saved config is no longer dirty", () => {
    const saved = base()
    let working = applyOverride(saved, "radius", "button", 2)
    working = resetOverrides(working)
    assert.equal(isDirty(working, saved), false)
  })
})