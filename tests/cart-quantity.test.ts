import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CART_QTY_MAX,
  CART_QTY_MIN,
  clampCartQuantity,
} from "@/lib/cart-quantity";

// S3: integer, finite, 1..99 at every client boundary (server re-checks in
// create_order; cart_items carries cart_items_quantity_range).

describe("clampCartQuantity", () => {
  it("passes 1..99 through", () => {
    assert.equal(clampCartQuantity(1), 1);
    assert.equal(clampCartQuantity(99), 99);
    assert.equal(clampCartQuantity(7), 7);
  });

  it("floors floats and clamps out-of-range", () => {
    assert.equal(clampCartQuantity(2.9), 2);
    assert.equal(clampCartQuantity(0), 1);
    assert.equal(clampCartQuantity(-40), 1);
    assert.equal(clampCartQuantity(100), 99);
    assert.equal(clampCartQuantity(1e9), 99);
  });

  it("falls back to the minimum for non-finite input", () => {
    assert.equal(clampCartQuantity(NaN), 1);
    assert.equal(clampCartQuantity(Infinity), 1);
    assert.equal(clampCartQuantity(undefined), 1);
    assert.equal(clampCartQuantity("abc"), 1);
  });

  it("coerces numeric strings", () => {
    assert.equal(clampCartQuantity("5"), 5);
    assert.equal(clampCartQuantity("120"), 99);
  });

  it("bounds match the DB CHECK", () => {
    assert.equal(CART_QTY_MIN, 1);
    assert.equal(CART_QTY_MAX, 99);
  });
});

describe("cart-context writes go through the clamp", () => {
  const src = readFileSync("lib/cart-context.tsx", "utf8");

  it("no raw quantity write to cart_items remains", () => {
    for (const banned of [
      "update({ quantity })",
      "quantity: gi.quantity }",
      "quantity: ex.quantity + gi.quantity }",
      "JSON.parse(raw) : [])",
    ]) {
      assert.ok(!src.includes(banned), `raw write still present: ${banned}`);
    }
    // The one remaining `quantity: qty` write uses qty clamped at the top of
    // addItem — assert the derivation, not the use site.
    assert.match(src, /const qty = clampCartQuantity\(item\.quantity \?\? 1\)/);
  });

  it("clamp is applied at every DB boundary", () => {
    assert.match(src, /clampCartQuantity\(item\.quantity \?\? 1\)/);
    assert.match(src, /clampCartQuantity\(ex\.quantity \+ gi\.quantity\)/);
    assert.match(src, /clampCartQuantity\(gi\.quantity\)/);
    assert.match(src, /clampCartQuantity\(quantity\)/);
  });
});
