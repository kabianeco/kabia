/**
 * Theme engine — resolver, schema and fallback unit tests.
 *
 * Pure logic: no database, no network. Exercises the three shape presets,
 * override merging, rejection of out-of-allowlist overrides, and the safe
 * fallbacks when a stored row references an unknown preset or font (e.g. after
 * a future migration removes one).
 *
 * Run under `--conditions=react-server` so `server-only` modules resolve to
 * their no-op build instead of throwing.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { resolveTheme, resolveDefaultTheme, resolveThemeSafe } from "../lib/theme-engine/resolve.ts"
import { parseThemeConfig, isValidThemeConfig, CURRENT_SCHEMA_VERSION } from "../lib/theme-engine/schema.ts"
import { SHAPE_PRESETS, getPreset } from "../lib/theme-engine/presets.ts"
import { DEFAULT_THEME_CONFIG } from "../lib/theme-engine/types.ts"
import { resolveBodyFontVar, resolveDisplayFontVar, APPROVED_BODY_FONTS, APPROVED_DISPLAY_FONTS } from "../lib/theme-engine/fonts.ts"

describe("preset resolution", () => {
  it("resolves the sharp preset to its exact token targets (every radius is 0)", () => {
    const r = resolveTheme({ ...DEFAULT_THEME_CONFIG, shapePreset: "sharp" })
    assert.equal(r.vars["--theme-radius-button"], "0px")
    assert.equal(r.vars["--theme-radius-image"], "0px")
    assert.equal(r.vars["--theme-radius-product-image"], "0px")
    assert.equal(r.vars["--theme-radius-card"], "0px")
    assert.equal(r.vars["--theme-radius-input"], "0px")
    assert.equal(r.vars["--theme-radius-dialog"], "0px")
    assert.equal(r.vars["--theme-radius-badge"], "0px")
    assert.equal(r.vars["--theme-radius-navigation"], "0px")
    assert.equal(r.vars["--theme-radius-icon-container"], "0px")
    assert.equal(r.vars["--theme-border-width"], "1px")
    assert.equal(r.vars["--theme-icon-stroke-width"], "1.4")
  })

  it("resolves the balanced preset to its exact token targets (current design)", () => {
    const r = resolveDefaultTheme()
    assert.equal(r.vars["--theme-radius-button"], "8px")
    assert.equal(r.vars["--theme-radius-image"], "5px")
    assert.equal(r.vars["--theme-radius-product-image"], "5px")
    assert.equal(r.vars["--theme-radius-card"], "10px")
    assert.equal(r.vars["--theme-radius-input"], "6px")
    assert.equal(r.vars["--theme-radius-dialog"], "10px")
    assert.equal(r.vars["--theme-radius-badge"], "8px")
    assert.equal(r.vars["--theme-radius-navigation"], "6px")
    assert.equal(r.vars["--theme-radius-icon-container"], "6px")
    assert.equal(r.vars["--theme-border-width"], "1px")
    assert.equal(r.vars["--theme-icon-stroke-width"], "1.6")
  })

  it("resolves the soft preset to its exact token targets (generous everywhere except cards)", () => {
    const r = resolveTheme({ ...DEFAULT_THEME_CONFIG, shapePreset: "soft" })
    assert.equal(r.vars["--theme-radius-button"], "999px")
    assert.equal(r.vars["--theme-radius-image"], "32px")
    assert.equal(r.vars["--theme-radius-product-image"], "32px")
    assert.equal(r.vars["--theme-radius-card"], "16px")
    assert.equal(r.vars["--theme-radius-input"], "20px")
    assert.equal(r.vars["--theme-radius-dialog"], "28px")
    assert.equal(r.vars["--theme-radius-badge"], "999px")
    assert.equal(r.vars["--theme-radius-navigation"], "20px")
    assert.equal(r.vars["--theme-radius-icon-container"], "16px")
    assert.equal(r.vars["--theme-icon-stroke-width"], "1.75")
  })
})

describe("override merging", () => {
  it("applies a single radius override and leaves the rest on the preset", () => {
    const r = resolveTheme({
      ...DEFAULT_THEME_CONFIG,
      overrides: { radius: { button: 2 } },
    })
    assert.equal(r.vars["--theme-radius-button"], "2px")
    assert.equal(r.vars["--theme-radius-card"], "10px") // still balanced default
  })

  it("rejects an out-of-allowlist radius value (parses to null → fallback)", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: { radius: { button: 7 } },
    })
    // 7 is not in the approved radius allowlist → the whole config is invalid.
    assert.equal(cfg, null)
  })

  it("rejects an out-of-allowlist border opacity", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: { border: { opacity: 0.5 } },
    })
    assert.equal(cfg, null)
  })

  it("accepts a valid shadow enum override", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: { shadow: { card: "medium" } },
    })
    assert.ok(cfg)
    const r = resolveTheme(cfg!)
    assert.equal(r.vars["--theme-shadow-card"], "0 4px 12px -2px color-mix(in srgb, var(--color-ink) 12%, transparent)")
  })
})

describe("fallbacks", () => {
  it("falls back to balanced when the preset is unknown", () => {
    const r = resolveThemeSafe({
      schemaVersion: 1,
      shapePreset: "future_preset" as unknown as string,
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: {},
    })
    assert.equal(r.config.shapePreset, "balanced")
    assert.equal(r.vars["--theme-radius-button"], "8px")
  })

  it("falls back to Kabia Original fonts when an identifier is unknown", () => {
    assert.equal(resolveBodyFontVar("removed_font" as never), "var(--font-instrument-sans)")
    assert.equal(resolveDisplayFontVar("removed_font" as never), "var(--font-instrument-serif)")
    assert.equal(resolveBodyFontVar(undefined), "var(--font-instrument-sans)")
  })

  it("falls back to the default theme entirely when JSON is invalid", () => {
    const r = resolveThemeSafe({ garbage: true })
    assert.equal(r.config.shapePreset, "balanced")
    assert.equal(r.config.fonts.body, "instrument_sans")
    assert.equal(r.config.fonts.display, "instrument_serif")
  })

  it("falls back when the shape is not an object", () => {
    assert.equal(parseThemeConfig(null), null)
    assert.equal(parseThemeConfig("balanced"), null)
    assert.equal(parseThemeConfig(42), null)
    assert.equal(isValidThemeConfig(undefined), false)
  })
})

describe("schema versioning and default fidelity", () => {
  it("exposes the current schema version", () => {
    assert.equal(CURRENT_SCHEMA_VERSION, 1)
    assert.equal(DEFAULT_THEME_CONFIG.schemaVersion, 1)
  })

  it("the default theme reproduces the current premium design", () => {
    const r = resolveDefaultTheme()
    // Balanced keeps a small, "a little" radius on interactive controls.
    assert.equal(r.vars["--theme-radius-button"], "8px")
    // Media radius stays 5px (the original --radius-media).
    assert.equal(r.vars["--theme-radius-image"], "5px")
    // Body + display resolve to the Instrument pair.
    assert.equal(r.vars["--font-body"], "var(--font-instrument-sans)")
    assert.equal(r.vars["--font-display"], "var(--font-instrument-serif)")
  })

  it("derives fonts from a typography profile when fonts is absent (old-row safety)", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "soft_contemporary",
    })
    assert.ok(cfg)
    assert.equal(cfg!.fonts.body, "dm_sans")
    assert.equal(cfg!.fonts.display, "fraunces")
  })
})

describe("font allowlist integrity", () => {
  it("exposes exactly four approved body fonts and four approved display fonts", () => {
    assert.equal(APPROVED_BODY_FONTS.length, 4)
    assert.equal(APPROVED_DISPLAY_FONTS.length, 4)
    assert.deepEqual(
      APPROVED_BODY_FONTS.map((f) => f.id).sort(),
      ["dm_sans", "instrument_sans", "manrope", "source_sans_3"],
    )
    assert.deepEqual(
      APPROVED_DISPLAY_FONTS.map((f) => f.id).sort(),
      ["cormorant_garamond", "fraunces", "instrument_serif", "lora"],
    )
  })

  it("every resolved CSS variable is an approved var(--font-…) — never arbitrary CSS", () => {
    for (const f of [...APPROVED_BODY_FONTS, ...APPROVED_DISPLAY_FONTS]) {
      const v = f.role === "body" ? resolveBodyFontVar(f.id) : resolveDisplayFontVar(f.id)
      assert.ok(v.startsWith("var(--font-"), `unexpected css var ${v}`)
      assert.ok(!v.includes("http"), "no remote URLs in font vars")
      assert.ok(!v.includes('"'), "no string-literal font-family values")
    }
  })
})

describe("preset source of truth", () => {
  it("defines exactly three presets with stable ids", () => {
    assert.deepEqual(Object.keys(SHAPE_PRESETS).sort(), ["balanced", "sharp", "soft"])
  })

  it("balanced is the default when an id is unknown", () => {
    assert.equal(getPreset("nope").id, "balanced")
  })
})