import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewInputSchema } from "@/lib/reviews/schema";

// S18: validation matrix + write-path pins. The rate-limit and uniqueness
// behavior need a live session; the schema matrix runs database-free.

const good = {
  product_id: "550e8400-e29b-41d4-a716-446655440000",
  reviewer_name: "Ayşe",
  rating: 5,
  review_text: "Balı çok beğendik, kargosu da hızlıydı.",
};

describe("reviewInputSchema", () => {
  it("accepts a well-formed review", () => {
    assert.equal(reviewInputSchema.safeParse(good).success, true);
  });

  it("rejects short text, long text, bad rating, bad product", () => {
    assert.equal(reviewInputSchema.safeParse({ ...good, review_text: "kısa" }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, review_text: "x".repeat(2001) }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, rating: 0 }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, rating: 6 }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, rating: 4.5 }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, product_id: "nope" }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, reviewer_name: "  " }).success, false);
    assert.equal(reviewInputSchema.safeParse({ ...good, reviewer_name: "x".repeat(121) }).success, false);
  });

  it("bounds match the DB CHECKs", () => {
    const sql = readFileSync("supabase/migrations/20260926001200_review_guards.sql", "utf8");
    assert.match(sql, /between 10 and 2000/);
    assert.match(sql, /between 1 and 120/);
  });
});

describe("review write path", () => {
  it("panel no longer inserts into reviews from the browser", () => {
    const src = readFileSync("components/shop/product-reviews-panel.tsx", "utf8");
    assert.ok(!src.includes('from("reviews").insert'), "direct browser insert removed");
    assert.match(src, /submitReviewAction\(/);
  });

  it("action rate-limits, pins RLS and maps duplicates", () => {
    const src = readFileSync("lib/reviews/actions.ts", "utf8");
    assert.match(src, /checkRateLimit\("review_submit"/);
    assert.match(src, /createSupabaseServerClient\(\)/);
    assert.ok(!src.includes("createSupabaseAdminClient"), "caller's session, not admin");
    assert.match(src, /23505/);
    assert.match(src, /Bu ürün için zaten değerlendirmeniz var/);
  });
});
