import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PRODUCER_READ_COLUMNS,
  PRODUCER_REQUIRED_ON_INSERT,
  PRODUCER_WRITE_COLUMNS,
  buildProducerRow,
} from "../lib/admin/producer-fields.ts"

/**
 * The `products.certification` outage is the reason this file exists: a field
 * the form showed but the write payload omitted broke every product creation
 * with an undiagnosable 23502. Producers get the same four-place invariant
 * from birth — form, schema, payload, select — with `source` as the column to
 * watch: Phase 2 adds it NOT NULL with no default, exactly the shape that
 * broke products.
 */

const input = {
  name: "Kayadibi Köyü Aile Bahçesi",
  slug: "ege-ceviz",
  source: "secki" as const,
  tagline: "Doğal üretim.",
  region: "Kayadibi Köyü Aile Bahçesi",
  product_type: "Ceviz",
  photo_url: "/images/kabuklu-ceviz.jpeg",
  story: "Birinci paragraf.\n\nİkinci paragraf.",
  production_place: null,
  method: null,
  inputs: null,
  certificates: null,
  why_selected: null,
  is_published: true,
  sort_order: 70,
}

describe("producer editor field coverage", () => {
  it("writes every column the table demands on insert", () => {
    const row = buildProducerRow(input)
    for (const column of PRODUCER_REQUIRED_ON_INSERT) {
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
    assert.deepEqual(Object.keys(buildProducerRow(input)).sort(), [...PRODUCER_WRITE_COLUMNS].sort())
  })

  it("reads back every column it writes", () => {
    const readable = new Set<string>(PRODUCER_READ_COLUMNS)
    for (const column of PRODUCER_WRITE_COLUMNS) {
      assert.ok(
        readable.has(column),
        `${column} is saved but never selected back, so the editor would show a stale value`,
      )
    }
  })

  it("carries the Phase 2 columns the storefront will read", () => {
    const row = buildProducerRow(input) as Record<string, unknown>
    assert.equal(row.source, "secki")
    assert.equal(row.tagline, "Doğal üretim.")
    assert.equal(row.sort_order, 70)
  })
})

describe("the form is the fourth place", () => {
  it("renders a named input for every column the save payload writes", async () => {
    // The other three places are asserted above and in the schema: what the
    // schema keeps, what the payload writes, what the select reads back.
    // This is the one that cannot be reached by importing a module: a field
    // missing here is a column that is validated, written and read back, and
    // that an operator has no way to set.
    const { readFile } = await import("node:fs/promises")
    const source = await readFile(
      new URL("../app/admin/(protected)/producers/producer-form.tsx", import.meta.url),
      "utf8",
    )
    const named = new Set([...source.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]))
    for (const column of PRODUCER_WRITE_COLUMNS) {
      assert.ok(named.has(column), `the producer form has no input named "${column}"`)
    }
  })
})
