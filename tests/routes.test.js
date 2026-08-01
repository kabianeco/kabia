/**
 * Route smoke tests against the production build.
 *
 * Boots `next start` once, then asserts that every shipped route responds and
 * that the pages that must show live Supabase data actually contain it. Run
 * `npm run build` first — this exercises `.next`, not the dev server.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.SMOKE_PORT ?? "3399";
const BASE = `http://127.0.0.1:${PORT}`;

let server;

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  throw new Error(`Server did not start on ${BASE}`);
}

before(async () => {
  server = spawn("npx", ["next", "start", "-p", PORT], {
    stdio: "ignore",
    env: process.env,
  });
  await waitForServer();
});

after(() => {
  server?.kill("SIGTERM");
});

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const body = res.status < 400 ? await res.text() : "";
  return { status: res.status, body, location: res.headers.get("location") };
}

describe("public routes render", () => {
  const routes = [
    ["/", "homepage"],
    ["/shop", "shop index"],
    ["/sepet", "cart"],
    ["/giris", "sign in"],
    ["/kayit", "sign up"],
    ["/blog", "journal"],
    ["/odeme", "checkout"],
  ];

  for (const [path, name] of routes) {
    it(`${name} (${path}) responds 200`, async () => {
      const { status } = await get(path);
      assert.equal(status, 200, `${path} returned ${status}`);
    });
  }
});

describe("shop is backed by real data", () => {
  it("lists products from the database", async () => {
    const { status, body } = await get("/shop");
    assert.equal(status, 200);
    // The seeded catalogue prices are rendered as Turkish lira figures.
    assert.match(body, /₺\d/, "no price found on the shop index");
    assert.match(body, /href="\/shop\//, "no product links on the shop index");
  });

  it("serves a product detail page for a real slug", async () => {
    const { body } = await get("/shop");
    const slug = body.match(/href="\/shop\/([a-z0-9-]+)"/)?.[1];
    assert.ok(slug, "could not find a product slug to follow");

    const detail = await get(`/shop/${slug}`);
    assert.equal(detail.status, 200);
    assert.match(detail.body, /Sepete ekle|Tükendi/, "no add-to-cart control");
    assert.match(detail.body, /₺\d/, "no price on the product page");
  });

  it("returns 404 for an unknown product", async () => {
    const { status } = await get("/shop/bu-urun-yok-12345");
    assert.equal(status, 404);
  });

  it("filters by category without leaving the server", async () => {
    const { status, body } = await get("/shop?kategori=kavrulmus");
    assert.equal(status, 200);
    assert.match(body, /Kavrulmuş/);
  });

  it("connects the homepage product ledger to the catalogue", async () => {
    const { body } = await get("/");
    assert.match(body, /href="\/shop\//, "homepage has no links into the shop");
    assert.match(body, /₺\d/, "homepage ledger shows no real prices");
  });
});

describe("legacy URLs keep working", () => {
  const redirects = [
    ["/magaza", "/shop"],
    ["/farm", "/#ciftlik"],
    ["/contact", "/#iletisim"],
  ];

  for (const [from, to] of redirects) {
    it(`${from} redirects to ${to}`, async () => {
      const { status, location } = await get(from);
      assert.equal(status, 308, `${from} returned ${status}`);
      assert.equal(location, to);
    });
  }
});

describe("shared shell and design system", () => {
  it("declares Turkish as the document language", async () => {
    const { body } = await get("/");
    assert.match(body, /<html[^>]+lang="tr"/);
  });

  it("renders exactly one header and one footer per page", async () => {
    for (const path of ["/", "/shop", "/giris", "/sepet"]) {
      const { body } = await get(path);
      const headers = body.match(/class="[^"]*site-header/g) ?? [];
      assert.equal(headers.length, 1, `${path} has ${headers.length} headers`);
      const footers = body.match(/<footer/g) ?? [];
      assert.equal(footers.length, 1, `${path} has ${footers.length} footers`);
    }
  });

  it("leaves the theme attribute to the client, deterministically", async () => {
    // The server must never emit data-theme: it cannot know a preference that
    // lives in localStorage, and emitting a guess is what causes the surface
    // to flip after hydration.
    const { body } = await get("/");
    assert.doesNotMatch(body, /<html[^>]+data-theme=/);
    assert.match(body, /kabia_theme/, "theme init script is missing");
    assert.match(
      body,
      /<html[^>]+lang="tr"/,
      "root element lost its language attribute",
    );
  });

  it("loads the premium fonts and no others", async () => {
    const { body } = await get("/");
    assert.match(body, /Instrument_Sans|instrument-sans/i);
    assert.match(body, /Instrument_Serif|instrument-serif/i);
    assert.doesNotMatch(body, /Space_Grotesk|space-grotesk/i);
  });
});

describe("protected routes", () => {
  it("renders the account shell without leaking data to anonymous visitors", async () => {
    const { status, body } = await get("/hesabim");
    assert.equal(status, 200);
    // The guard runs on the client; the server payload must not contain
    // any account content for a signed-out visitor.
    assert.doesNotMatch(body, /Siparişlerim<\/h1>/);
  });
});
