import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// S21 + S22: server-side account-area enforcement. Signed-out rendering and
// status codes need a live session; the wiring is pinned here database-free.

describe("S21 — server-side account gate", () => {
  const src = readFileSync("app/hesabim/layout.tsx", "utf8");

  it("redirects signed-out users on the server with the same next param", () => {
    assert.ok(!src.includes('"use client"'), "layout stays a server component");
    assert.match(src, /supabase\.auth\.getUser\(\)/);
    assert.match(src, /if \(!user\)/);
    assert.match(src, /\$\{routes\.login\}\?next=\$\{encodeURIComponent\(pathname\)\}/);
  });

  it("proxy supplies the request path for the next param", () => {
    const proxy = readFileSync("proxy.ts", "utf8");
    assert.match(proxy, /request\.headers\.set\("x-pathname"/);
  });

  it("client guard stays as the hydration fallback", () => {
    const guard = readFileSync("components/account/account-guard.tsx", "utf8");
    assert.match(guard, /router\.replace\(\`\$\{routes\.login\}\?next=/);
  });

  it("renders the page during SSR so a server notFound() is a real 404", () => {
    // Phase 2: the guard used to render a placeholder until hydration, so the
    // page segment (and its notFound) streamed after a 200 shell.
    const guard = readFileSync("components/account/account-guard.tsx", "utf8");
    assert.match(guard, /if \(hydrated && !isLoggedIn\) \{\n\s*return \(/);
    assert.ok(!guard.includes("if (!hydrated || !isLoggedIn)"));
  });
});

describe("S22 — real 404 for unknown or foreign order ids", () => {
  it("server gate calls notFound on missing or foreign rows", () => {
    const src = readFileSync("app/hesabim/siparislerim/[orderId]/page.tsx", "utf8");
    assert.ok(!src.includes('"use client"'), "gate stays a server component");
    assert.match(src, /notFound\(\)/);
    assert.match(src, /\.eq\("order_number", orderId\)/);
    assert.match(src, /\.eq\("user_id", user\.id\)/);
  });

  it("not-found copy is byte-identical to the old inline state", () => {
    const src = readFileSync("app/hesabim/siparislerim/[orderId]/not-found.tsx", "utf8");
    assert.match(src, /Sipariş bulunamadı/);
    assert.match(src, /Bu sipariş numarası hesabınıza ait değil ya da kaldırılmış olabilir\./);
    assert.match(src, /Siparişlerime dön/);
  });
});
