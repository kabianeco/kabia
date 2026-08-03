import { describe, it } from "node:test"
import assert from "node:assert/strict"

import nextConfig from "../next.config.ts"
import { fetchPublicProducts } from "../lib/catalog.ts"
import {
  ThemeSettingsReadError,
  getThemeSettingsRow,
  listThemeRevisions,
  readPublishedThemeFromClient,
  resolvePublishedThemeConfig,
} from "../lib/theme-settings.ts"
import { DEFAULT_THEME_CONFIG } from "../lib/theme-engine/types.ts"

function themeSettingsClient(result: { data: unknown; error: unknown }) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => result,
              }
            },
          }
        },
      }
    },
  }
}

function revisionsClient(result: { data: unknown; error: unknown; count?: number }) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return {
                    range: async () => result,
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

function productsClient(result: { data: unknown; error: unknown }) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order: async () => result,
              }
            },
          }
        },
      }
    },
  }
}

function publishedThemeClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: async () => result,
  }
}

describe("affected route contracts", () => {
  it("renders /magaza directly and permanently redirects only the misspelled admin route", async () => {
    const redirects = await nextConfig.redirects?.()
    assert.ok(redirects)
    assert.equal(
      redirects.some((entry) => entry.source === "/magaza"),
      false,
      "/magaza must be a real storefront route, not a document redirect",
    )
    assert.deepEqual(
      redirects.filter((entry) => entry.source === "/admin/apperance"),
      [{ source: "/admin/apperance", destination: "/admin/appearance", permanent: true }],
    )
  })

  it("distinguishes a missing theme singleton from a failed theme query", async () => {
    const missing = await getThemeSettingsRow(
      themeSettingsClient({ data: null, error: null }) as never,
    )
    assert.equal(missing, null)

    await assert.rejects(
      getThemeSettingsRow(
        themeSettingsClient({ data: null, error: { code: "PGRST000" } }) as never,
      ),
      (error: unknown) =>
        error instanceof ThemeSettingsReadError && error.operation === "settings",
    )
  })

  it("keeps missing and existing drafts as distinct stable editor states", async () => {
    const baseRow = {
      site_key: "default",
      published_config: DEFAULT_THEME_CONFIG,
      published_version: 3,
      schema_version: 1,
      published_at: null,
      published_by: null,
      draft_updated_at: null,
      draft_updated_by: null,
    }
    const withoutDraft = await getThemeSettingsRow(
      themeSettingsClient({
        data: { ...baseRow, draft_config: null },
        error: null,
      }) as never,
    )
    assert.equal(withoutDraft?.draftConfig, null)
    assert.deepEqual(withoutDraft?.publishedConfig, DEFAULT_THEME_CONFIG)

    const draft = { ...DEFAULT_THEME_CONFIG, shapePreset: "soft" as const }
    const withDraft = await getThemeSettingsRow(
      themeSettingsClient({
        data: { ...baseRow, draft_config: draft },
        error: null,
      }) as never,
    )
    assert.deepEqual(withDraft?.draftConfig, draft)
  })

  it("validates published themes and rejects invalid configuration before caching", () => {
    const resolved = resolvePublishedThemeConfig(DEFAULT_THEME_CONFIG)
    assert.equal(resolved.config.shapePreset, DEFAULT_THEME_CONFIG.shapePreset)
    assert.throws(
      () => resolvePublishedThemeConfig({ shapePreset: "unsafe" }),
      (error: unknown) =>
        error instanceof ThemeSettingsReadError && error.operation === "published",
    )
  })

  it("admits only a successful valid public-theme RPC result to the cache", async () => {
    const valid = await readPublishedThemeFromClient(
      publishedThemeClient({ data: DEFAULT_THEME_CONFIG, error: null }) as never,
    )
    assert.equal(valid.config.shapePreset, "balanced")

    for (const result of [
      { data: null, error: null },
      { data: null, error: { code: "PGRST000" } },
      { data: { shapePreset: "unsafe" }, error: null },
    ]) {
      await assert.rejects(
        readPublishedThemeFromClient(publishedThemeClient(result) as never),
        (error: unknown) =>
          error instanceof ThemeSettingsReadError && error.operation === "published",
      )
    }
  })

  it("surfaces revision-query failure separately from an empty revision history", async () => {
    const empty = await listThemeRevisions(
      revisionsClient({ data: [], error: null, count: 0 }) as never,
      1,
      10,
    )
    assert.deepEqual(empty, { rows: [], total: 0 })

    await assert.rejects(
      listThemeRevisions(
        revisionsClient({ data: null, error: { code: "PGRST000" } }) as never,
        1,
        10,
      ),
      (error: unknown) =>
        error instanceof ThemeSettingsReadError && error.operation === "revisions",
    )
  })

  it("does not present a failed product query as an empty catalogue", async () => {
    const result = await fetchPublicProducts(
      productsClient({ data: null, error: { code: "PGRST000" } }) as never,
    )
    assert.deepEqual(result, { status: "error" })

    const empty = await fetchPublicProducts(
      productsClient({ data: [], error: null }) as never,
    )
    assert.deepEqual(empty, { status: "ok", products: [] })
  })
})
