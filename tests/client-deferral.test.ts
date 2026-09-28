import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// §8.3: the browser Supabase client (~65 KB gzipped, with realtime) must not
// ride in the initial bundle. It loads via dynamic import on first async use;
// render paths never touch it. Pinned database-free (bundle contents need a
// production build; the full checkpoint re-measures JS per route).

const CLIENT_FILES = [
  "lib/auth-context.tsx",
  "lib/cart-context.tsx",
  "lib/checkout-context.tsx",
  "lib/orders-context.tsx",
  "lib/favorites-context.tsx",
  "lib/notification-prefs.ts",
  "lib/checkout-order.ts",
  "components/checkout/checkout-flow.tsx",
  "app/hesabim/favorilerim/page.tsx",
  "app/hesabim/page.tsx",
];

describe("supabase client deferral", () => {
  it("client module has no static implementation import", () => {
    const src = readFileSync("lib/supabase/client.ts", "utf8");
    assert.ok(!src.match(/^import .*@supabase\/ssr/m), "static @supabase/ssr import found");
    assert.ok(!src.includes("createSupabaseBrowserClient"), "sync accessor removed");
    assert.match(src, /import\("@supabase\/ssr"\)/);
    assert.match(src, /export function getSupabaseBrowserClient/);
  });

  it("every browser call site awaits the loader", () => {
    for (const file of CLIENT_FILES.filter((f) => f !== "lib/checkout-order.ts")) {
      const src = readFileSync(file, "utf8");
      assert.ok(!src.includes("createSupabaseBrowserClient"), `${file}: sync call remains`);
      assert.match(src, /getSupabaseBrowserClient/, `${file}: loader not used`);
    }
    // checkout-order receives the factory as a parameter — pin the async shape.
    const co = readFileSync("lib/checkout-order.ts", "utf8");
    assert.match(co, /createClient: \(\) => Promise<SupabaseClient>/);
    assert.match(co, /await \(await createClient\(\)\)\.rpc/);
  });

  it("files that no longer talk to Supabase from the browser stay that way", () => {
    // Phase 2: saved cards retired; password login and profile saves go
    // through server actions only.
    for (const file of ["lib/cards-context.tsx", "components/auth/login-form.tsx", "app/hesabim/bilgilerim/page.tsx"]) {
      const src = readFileSync(file, "utf8");
      assert.ok(!/SupabaseBrowserClient/.test(src), `${file}: browser client reintroduced`);
    }
  });

  it("no render-time client in providers", () => {
    for (const file of CLIENT_FILES.filter((f) => f.endsWith("-context.tsx"))) {
      const src = readFileSync(file, "utf8");
      const renderLevel = src.split("\n").filter((l) => /^  const supabase = /.test(l));
      assert.deepEqual(renderLevel, [], `${file}: render-time client: ${renderLevel}`);
      assert.ok(!src.match(/,\s*supabase\s*\]/), `${file}: stale dep`);
    }
  });

  it("anonymous visitors never load the client (session-cookie gate)", () => {
    const auth = readFileSync("lib/auth-context.tsx", "utf8");
    assert.match(auth, /function hasSessionCookie\(\)/);
    assert.match(auth, /if \(hasSessionCookie\(\)\) \{\n      void attach\(\)/);
    // A sign-in elsewhere still attaches: supabase-js's own channel, refocus, same-tab sign-in.
    assert.match(auth, /new BroadcastChannel\(authStorageKey\(\)\)/);
    assert.match(auth, /"visibilitychange", recheck/);
    assert.match(auth, /void attachRef\.current\(\)/);
    for (const file of ["lib/cart-context.tsx", "lib/favorites-context.tsx", "lib/checkout-context.tsx"]) {
      const src = readFileSync(file, "utf8");
      assert.match(src, /if \(userId\) \{\n        const supabase = await getSupabaseBrowserClient\(\)/, `${file}: guests must not load the client`);
    }
  });
});

