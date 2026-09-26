import { describe, it } from "node:test"
import assert from "node:assert/strict"

import nextConfig from "../next.config.ts"
import { fetchProductBySlug, fetchPublicProducts } from "../lib/catalog.ts"
import { fetchPublicProducers } from "../lib/producers.ts"
import { routes, sitemapStaticPaths } from "../lib/site.ts"
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

/**
 * Stands in for the query builder fetchPublicProducts actually chains:
 * from().select().eq().order().limit(). Each step returns the same object, so
 * the stub keeps answering however long that chain grows — the previous version
 * stopped at order() and broke the moment limit() was added to the real query.
 */
function productsClient(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  for (const step of ["select", "eq", "neq", "order", "limit", "range"]) {
    builder[step] = () => builder
  }
  builder.maybeSingle = async () => result
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return { from: () => builder }
}

function producersClient(result: { data: unknown; error: unknown }) {
  // Same chainable stand-in as productsClient: the producer queries order by
  // sort_order and then created_at, so a single-depth stub breaks the moment
  // a second order() is chained.
  const builder: Record<string, unknown> = {}
  for (const step of ["select", "eq", "order"]) {
    builder[step] = () => builder
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return { from: () => builder }
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

  it("does not present a failed product read as a missing product", async () => {
    // A failed read must reach the route's error boundary, not notFound():
    // telling a visitor the product does not exist during an outage is wrong.
    await assert.rejects(
      fetchProductBySlug(productsClient({ data: null, error: { message: "boom" } }) as never, "kabuklu-badem"),
      /product read failed/,
    )
    // No row is the one case that still answers "no such product".
    assert.equal(
      await fetchProductBySlug(productsClient({ data: null, error: null }) as never, "yok"),
      null,
    )
  })

  it("does not present a failed producer query as an empty producer list", async () => {
    // The taxonomy migration being absent answers PGRST205 here. Reporting that
    // as "no producers are published yet" turns an outage into an editorial
    // statement, which is exactly what the neighbouring reads refuse to do.
    const failed = await fetchPublicProducers(
      producersClient({ data: null, error: { code: "PGRST205" } }) as never,
    )
    assert.deepEqual(failed, { status: "error" })

    const empty = await fetchPublicProducers(
      producersClient({ data: [], error: null }) as never,
    )
    assert.deepEqual(empty, { status: "ok", producers: [] })
  })

  it("maps a published producer row onto the card fields the grid reads", async () => {
    const result = await fetchPublicProducers(
      producersClient({
        data: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            slug: "ege-ceviz",
            name: "Kayadibi Köyü Aile Bahçesi",
            product_type: "Ceviz",
            region: "Kayadibi Köyü Aile Bahçesi",
            photo_url: "/images/kabuklu-ceviz.jpeg",
            story: null,
            production_place: null,
            method: null,
            inputs: null,
            certificates: null,
            why_selected: null,
            is_published: true,
            created_at: "2026-09-05T00:00:00.000Z",
          },
        ],
        error: null,
      }) as never,
    )
    assert.equal(result.status, "ok")
    assert.equal(result.status === "ok" && result.producers.length, 1)
    assert.equal(result.status === "ok" && result.producers[0].slug, "ege-ceviz")
    assert.equal(result.status === "ok" && result.producers[0].productType, "Ceviz")
  })

  it("advertises the brand routes in the sitemap, not only the store and legal pages", () => {
    // The restructure exists to lead with land and producers; those were the
    // only pages the sitemap did not carry.
    for (const path of [routes.farm, routes.secki, routes.mutfak, "/badem", routes.journal, routes.producers]) {
      assert.ok(
        sitemapStaticPaths.some((entry) => entry.path === path),
        `${path} must be advertised in the sitemap`,
      )
    }
  })

  it("keeps preview-only and per-item routes out of the sitemap's static entries", () => {
    for (const entry of sitemapStaticPaths) {
      assert.ok(entry.path.startsWith("/"), `${entry.path} must be a root-relative path`)
      assert.ok(!entry.path.includes("["), `${entry.path} must not be a dynamic segment`)
      assert.ok(!entry.path.includes("onizleme-"), `${entry.path} must not be a preview URL`)
    }
    const paths = sitemapStaticPaths.map((entry) => entry.path)
    assert.equal(new Set(paths).size, paths.length, "sitemap paths must be unique")
  })
})

describe("§8.7 Offer shipping and return policy", () => {
  it("product Offer carries shippingDetails and a finite return policy", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("app/shop/[slug]/page.tsx", "utf8")
    assert.match(src, /shippingDetails: \{/)
    assert.match(src, /"@type": "OfferShippingDetails"/)
    assert.match(src, /handlingTime: \{ "@type": "QuantitativeValue", minValue: 0, maxValue: 3/)
    assert.match(src, /transitTime: \{ "@type": "QuantitativeValue", minValue: 2, maxValue: 5/)
    assert.match(src, /hasMerchantReturnPolicy: \{/)
    assert.match(src, /merchantReturnDays: 14/)
    assert.match(src, /MerchantReturnFiniteReturnWindow/)
    assert.ok(!src.includes('"@type": "LocalBusiness"'), "no LocalBusiness without farm facts")
  })
})
