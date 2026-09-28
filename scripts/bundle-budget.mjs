#!/usr/bin/env node
// Bundle budget for storefront routes, measured on the existing production
// build (`npm run build` first). Starts `next start` on a free port with the
// Supabase env removed (pages render their honest empty/error states; the
// scripts a route loads do not depend on data), reads each route's <script>
// tags and gzips the referenced chunks from .next/static.
//
//   node scripts/bundle-budget.mjs          human-readable table, exit 1 on a breach
//   node scripts/bundle-budget.mjs --json   JSON (used by tests/bundle-budget.test.ts)
//
// Budgets are the initial (HTML-referenced) JavaScript per route, gzipped.
// Lazily loaded chunks (reviews tab, motion features) are excluded by design.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const ROOT = process.cwd();
const DEFAULT_BUDGET_KB = 200;
// The homepage intro is a Framer Motion choreography and its heading is the
// LCP element, so the route carries the motion runtime from the first frame.
// Budgeted at its measured size so it cannot grow; bringing it under 200 KB
// means rewriting the intro without the library.
const BUDGET_KB = { "/": 215 };
const ROUTES = [
  "/", "/magaza", "/secki", "/mutfak", "/ciftlik", "/badem", "/ureticiler",
  "/ureticiler/kabia-ciftligi", "/magaza/kabia-ciftligi", "/shop/kabuklu-badem",
  "/gunluk", "/iletisim",
];
// Routes that animate from their first frame may carry the motion runtime;
// every other storefront route must not.
const MOTION_ROUTES = new Set(["/"]);
const MARKERS = {
  motion: "transformPerspective", // Framer Motion core
  supabase: "GoTrueClient", // supabase-js auth client
};

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not start: ${url}`);
}

export async function measure() {
  if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) return { skipped: "no production build (.next/BUILD_ID); run npm run build" };
  const port = await freePort();
  const env = { ...process.env, NODE_ENV: "production", PORT: String(port) };
  for (const key of Object.keys(env)) if (/SUPABASE|DATABASE_URL|^VERCEL/.test(key)) delete env[key];
  const server = spawn(process.execPath, [join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    cwd: ROOT, env, stdio: "ignore",
  });
  const base = `http://localhost:${port}`;
  try {
    await waitFor(`${base}/robots.txt`);
    const sizes = new Map();
    const chunkSize = (src) => {
      if (!sizes.has(src)) {
        const file = join(ROOT, ".next", decodeURIComponent(src.replace(/^\/_next\//, "")));
        const buf = readFileSync(file);
        const text = buf.toString("utf8");
        sizes.set(src, {
          gz: gzipSync(buf).length,
          motion: text.includes(MARKERS.motion),
          supabase: text.includes(MARKERS.supabase),
        });
      }
      return sizes.get(src);
    };
    const routes = [];
    for (const route of ROUTES) {
      const html = await (await fetch(base + route)).text();
      const srcs = [...new Set([...html.matchAll(/<script[^>]+src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))]
        // polyfills are nomodule: modern browsers never download them
        .filter((src) => !/\/polyfills-/.test(src));
      const chunks = srcs.map((src) => ({ src, ...chunkSize(src) }));
      const kb = Math.round(chunks.reduce((a, c) => a + c.gz, 0) / 102.4) / 10;
      routes.push({
        route,
        kb,
        budgetKb: BUDGET_KB[route] ?? DEFAULT_BUDGET_KB,
        motion: chunks.some((c) => c.motion),
        motionAllowed: MOTION_ROUTES.has(route),
        supabase: chunks.some((c) => c.supabase),
        chunks: chunks.length,
      });
    }
    return { routes };
  } finally {
    server.kill();
  }
}

export function breaches(result) {
  if (result.skipped) return [];
  const out = [];
  for (const r of result.routes) {
    if (r.kb > r.budgetKb) out.push(`${r.route}: ${r.kb} KB initial JS > ${r.budgetKb} KB budget`);
    if (r.motion && !r.motionAllowed) out.push(`${r.route}: Framer Motion in the initial bundle`);
    if (r.supabase) out.push(`${r.route}: supabase-js in the initial bundle`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await measure();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result));
  } else if (result.skipped) {
    console.log(result.skipped);
  } else {
    for (const r of result.routes) {
      console.log(`${r.route.padEnd(28)} ${String(r.kb).padStart(6)} KB / ${r.budgetKb}${r.motion ? "  motion" : ""}${r.supabase ? "  SUPABASE" : ""}`);
    }
    const b = breaches(result);
    if (b.length) {
      console.error(b.join("\n"));
      process.exitCode = 1;
    }
  }
}
