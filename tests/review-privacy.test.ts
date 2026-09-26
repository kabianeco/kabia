import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapReview } from "@/lib/catalog";

// S17: the storefront classifies reviews from the public_reviews view shape
// (account_backed, no user_id). The trigger always sources reviewer_name from
// the profile (migration text pinned below).

const row = {
  reviewer_name: "Ayşe",
  rating: 5,
  review_text: "Harika.",
  is_verified_purchase: true,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("mapReview view shape", () => {
  it("marks account-backed rows from account_backed", () => {
    assert.equal(mapReview({ ...row, account_backed: true }).accountBacked, true);
    assert.equal(mapReview({ ...row, account_backed: false }).accountBacked, false);
  });

  it("still classifies legacy user_id rows (seeded exclusion intact)", () => {
    assert.equal(mapReview({ ...row, user_id: "u1" }).accountBacked, true);
    assert.equal(mapReview({ ...row, user_id: null }).accountBacked, false);
  });
});

describe("review_privacy migration", () => {
  const src = readFileSync("supabase/migrations/20260926001100_review_privacy.sql", "utf8");

  it("always sources reviewer_name from the profile", () => {
    assert.match(src, /new\.reviewer_name := v_name;/);
    assert.ok(!src.includes("if new.reviewer_name is null"), "conditional fill removed");
  });

  it("exposes the view without user_id", () => {
    assert.match(src, /create or replace view public\.public_reviews/);
    const viewBody = src.slice(src.indexOf("create or replace view"), src.indexOf("from public.reviews r;"));
    assert.ok(!/(^|,)\s*r?\.?user_id\s*,/m.test(viewBody), "view must not project user_id");
    assert.match(src, /account_backed/);
  });

  it("keeps the deployed read path working until deploy", () => {
    assert.ok(!src.includes("drop policy if exists reviews_public_read"), "kept for deployed code");
    assert.match(src, /reviews_admin_select/);
  });
});

describe("storefront reads no user_id", () => {
  it("fetchProductBySlug selects the view without user_id", () => {
    const src = readFileSync("lib/catalog.ts", "utf8");
    assert.match(src, /from\("public_reviews"\)/);
    assert.ok(!src.includes("reviews(id, reviewer_name, user_id"), "base-table select removed");
  });
});
