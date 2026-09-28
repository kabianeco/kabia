import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Initial JavaScript per storefront route may not silently grow again
// (SEO/perf pass 2: ~281 KB -> ~170 KB on most routes). Measured on the last
// production build by scripts/bundle-budget.mjs, which runs in its own
// process: this suite forbids network access, the measurement needs to talk
// to a local `next start`. Without a build there is nothing to measure.

const hasBuild = existsSync(".next/BUILD_ID");

describe("bundle budget", () => {
  it("storefront routes stay within their initial-JS budgets", { skip: hasBuild ? false : "no production build — run `npm run build` first", timeout: 120_000 }, () => {
    const run = spawnSync(process.execPath, ["scripts/bundle-budget.mjs", "--json"], { encoding: "utf8", timeout: 110_000 });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout.trim().split("\n").pop() ?? "{}");
    assert.ok(result.routes?.length, "no routes measured");
    const breaches: string[] = [];
    for (const r of result.routes as { route: string; kb: number; budgetKb: number; motion: boolean; motionAllowed: boolean; supabase: boolean }[]) {
      if (r.kb > r.budgetKb) breaches.push(`${r.route}: ${r.kb} KB > ${r.budgetKb} KB`);
      if (r.motion && !r.motionAllowed) breaches.push(`${r.route}: Framer Motion in the initial bundle`);
      if (r.supabase) breaches.push(`${r.route}: supabase-js in the initial bundle`);
    }
    assert.deepEqual(breaches, []);
  });
});
