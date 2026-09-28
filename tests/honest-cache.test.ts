import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A failed storefront read must never become the cached answer: unstable_cache
// stores whatever resolves, so failures are thrown inside it and turned back into
// the honest error shape outside (lib/honest-cache.ts). Verified at runtime with
// a simulated Supabase outage: sitemap 500 during, full 54 URLs on the very next
// request after (SEO/perf pass 2). These pins keep the shape from regressing.

describe("honest storefront cache", () => {
  const helper = readFileSync("lib/honest-cache.ts", "utf8");

  it("throws failures inside the cache and degrades outside it", () => {
    assert.match(helper, /if \(isFailure\(result\)\) throw new UncachedReadFailure/);
    assert.match(helper, /if \(!client\) throw new UncachedReadFailure/);
    assert.match(helper, /return fallback/);
  });

  it("every storefront catalogue and producer reader goes through it", () => {
    for (const [file, names] of [
      ["lib/catalog.ts", ["getCachedPublicProducts", "getCachedProductBase", "getCachedProducerProducts", "getCachedProductReviews", "getCachedRelatedProducts", "getCachedFeaturedFullProducts", "getCachedIntroEntries"]],
      ["lib/producers.ts", ["getCachedPublicProducers", "getCachedSeckiProducers", "getCachedProducersBySource", "getCachedProducerBySlug"]],
    ] as const) {
      const src = readFileSync(file, "utf8");
      for (const name of names) {
        assert.match(src, new RegExp(`export const ${name} = honestCache\\(`), `${file}: ${name} must use honestCache`);
      }
    }
  });

  it("the homepage collection no longer queries per request", () => {
    const src = readFileSync("components/home/product-collection.tsx", "utf8");
    assert.ok(!src.includes("createSupabaseServerClient"), "per-request client is back");
    assert.match(src, /getCachedIntroEntries\(/);
  });

  it("the sitemap renders per request and refuses to publish a partial list", () => {
    const src = readFileSync("app/sitemap.ts", "utf8");
    assert.match(src, /export const dynamic = "force-dynamic"/);
    assert.ok(!/export const revalidate/.test(src), "build-time prerender is back");
    assert.match(src, /productsResult\.status !== "ok"\) throw/);
    assert.match(src, /producersResult\.status !== "ok"\) throw/);
  });
});
