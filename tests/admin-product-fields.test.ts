import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PRODUCT_READ_COLUMNS,
  PRODUCT_REQUIRED_ON_INSERT,
  PRODUCT_WRITE_COLUMNS,
  buildProductRow,
  requiresOrganicConfirmation,
} from "../lib/admin/product-fields.ts"

/**
 * Creating a product failed with "Zorunlu bir alan boş bırakılamaz." — the
 * dashboard's message for SQLSTATE 23502 — and the failing column was one the
 * form never showed: `products.certification` is NOT NULL with no default (the
 * taxonomy migration backfilled it, then set NOT NULL), and the save action's
 * insert payload omitted it.
 *
 * These tests hold the invariant that made the bug possible, not just the one
 * column: what the editor writes, what it reads back, and what the table
 * demands on insert have to agree.
 */

const input = {
  name: "Kabuklu Ceviz",
  slug: "kabuklu-ceviz",
  category_id: "11111111-1111-4111-8111-111111111111",
  short_description: "Kısa",
  description: "Uzun",
  base_price: 590,
  original_price: null,
  main_image_url: "/images/kabuklu-ceviz.jpeg",
  origin: null,
  production_method: null,
  shelf_life: null,
  storage_conditions: null,
  certifications: null,
  is_active: true,
  is_featured: false,
  low_stock_threshold: 5,
  display_order: 0,
  seo_title: null,
  seo_description: null,
  source: "secki" as const,
  certification: "kabia_secki" as const,
  producer_id: "22222222-2222-4222-8222-222222222222",
  harvest_year: 2025,
  lot_code: "KC-2025-01",
  variety: "Chandler",
  rootstock: null,
  processing: null,
  allergens: null,
  net_weight: "500 g",
  variants: [],
}

describe("product editor field coverage", () => {
  it("writes every column the table demands on insert", () => {
    const row = buildProductRow(input)
    for (const column of PRODUCT_REQUIRED_ON_INSERT) {
      assert.ok(
        column in row,
        `${column} is NOT NULL with no database default, so the insert must supply it`,
      )
      assert.notEqual(
        (row as Record<string, unknown>)[column],
        null,
        `${column} is NOT NULL, so the insert must not send null`,
      )
    }
  })

  it("writes exactly the declared write columns, no more and no fewer", () => {
    // A column in the payload but not in the list is unreviewed; a column in
    // the list but not in the payload is a field that silently does not save.
    assert.deepEqual(Object.keys(buildProductRow(input)).sort(), [...PRODUCT_WRITE_COLUMNS].sort())
  })

  it("reads back every column it writes", () => {
    const readable = new Set<string>(PRODUCT_READ_COLUMNS)
    for (const column of PRODUCT_WRITE_COLUMNS) {
      assert.ok(
        readable.has(column),
        `${column} is saved but never selected back, so the editor would show a stale value`,
      )
    }
  })

  it("carries the ten taxonomy fields the storefront reads", () => {
    const row = buildProductRow(input) as Record<string, unknown>
    assert.equal(row.source, "secki")
    assert.equal(row.certification, "kabia_secki")
    assert.equal(row.producer_id, "22222222-2222-4222-8222-222222222222")
    assert.equal(row.harvest_year, 2025)
    assert.equal(row.lot_code, "KC-2025-01")
    assert.equal(row.variety, "Chandler")
    assert.equal(row.rootstock, null)
    assert.equal(row.processing, null)
    assert.equal(row.allergens, null)
    assert.equal(row.net_weight, "500 g")
  })
})

describe("the form is the fourth place", () => {
  it("renders a named input for every column the save payload writes", async () => {
    // The other three places are asserted above and in admin-product-schema.
    // This is the one that cannot be reached by importing a module: a field
    // missing here is a column that is validated, written and read back, and
    // that an operator has no way to set.
    const { readFile } = await import("node:fs/promises")
    const source = await readFile(
      new URL("../app/admin/(protected)/products/product-form.tsx", import.meta.url),
      "utf8",
    )
    const named = new Set([...source.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]))
    for (const column of PRODUCT_WRITE_COLUMNS) {
      assert.ok(named.has(column), `the product form has no input named "${column}"`)
    }
  })

  it("offers the organic confirmation the server demands", async () => {
    const { readFile } = await import("node:fs/promises")
    const source = await readFile(
      new URL("../app/admin/(protected)/products/product-form.tsx", import.meta.url),
      "utf8",
    )
    assert.match(
      source,
      /name="organic_confirmed"/,
      "without this input the organic claim can never be saved through the form",
    )
  })
})

describe("the organic certification claim", () => {
  it("asks for confirmation when a product becomes organic", () => {
    assert.equal(requiresOrganicConfirmation(null, "organik_sertifikali"), true)
    assert.equal(requiresOrganicConfirmation("kabia_secki", "organik_sertifikali"), true)
    assert.equal(requiresOrganicConfirmation("kabia_mutfak", "organik_sertifikali"), true)
  })

  it("does not re-ask on every save of an already-organic product", () => {
    assert.equal(requiresOrganicConfirmation("organik_sertifikali", "organik_sertifikali"), false)
  })

  it("never asks for the two claims that are not legal assertions", () => {
    assert.equal(requiresOrganicConfirmation("organik_sertifikali", "kabia_secki"), false)
    assert.equal(requiresOrganicConfirmation(null, "kabia_secki"), false)
    assert.equal(requiresOrganicConfirmation(null, "kabia_mutfak"), false)
  })
})
