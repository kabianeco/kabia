import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// S26: every address/favorite mutation is owner-scoped in the query itself —
// RLS is the second boundary, not the only one (an admin-wide SELECT policy
// must never turn these queries into cross-account reads or writes).

function linesWith(src: string, ...needles: string[]): string[] {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => needles.every((n) => l.includes(n)));
}

describe("S26 ownership scoping", () => {
  it("every addresses update/delete carries user_id", () => {
    const src = readFileSync("lib/checkout-context.tsx", "utf8");
    const chains = [
      ...linesWith(src, 'from("addresses")', ".update("),
      ...linesWith(src, 'from("addresses")', ".delete("),
    ];
    assert.ok(chains.length >= 4, `expected address mutations, got ${chains.length}`);
    for (const c of chains) {
      assert.match(c, /\.eq\("user_id"/, `missing user_id scope: ${c}`);
    }
  });

  it("favorites select/delete carry user_id (upserts pin it in the body)", () => {
    const src = readFileSync("lib/favorites-context.tsx", "utf8");
    const chains = [
      ...linesWith(src, 'from("favorites")', ".select("),
      ...linesWith(src, 'from("favorites")', ".delete("),
    ];
    assert.ok(chains.length >= 2, `expected favorite read/delete, got ${chains.length}`);
    for (const c of chains) {
      assert.match(c, /\.eq\("user_id"/, `missing user_id scope: ${c}`);
    }
    assert.match(src, /upsert\(\{ user_id: userId/);
  });
});
