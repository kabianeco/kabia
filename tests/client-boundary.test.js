/**
 * Client/server boundary guard.
 *
 * A `"use client"` module that imports an async component pulls that component
 * into the browser bundle, where React re-invokes it on every render attempt
 * instead of awaiting it once on the server. When such a component fetches —
 * `SiteFooter` reads site settings — the result is an unbounded request loop
 * and a page that never settles.
 *
 * Static import graph check, so it costs nothing and catches the mistake at the
 * point it is made rather than in the browser.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const SOURCE = /\.(tsx|ts)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (SOURCE.test(entry)) out.push(path);
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(root));
const source = new Map(files.map((path) => [path, readFileSync(path, "utf8")]));

const isClient = (text) => /^\s*["']use client["']/.test(text);
const exportsAsyncComponent = (text) =>
  /export\s+async\s+function\s+[A-Z]/.test(text);

/** Resolve an `@/…` specifier to the file it actually points at. */
function resolveAlias(specifier) {
  const base = specifier.replace(/^@\//, "");
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    if (source.has(candidate)) return candidate;
  }
  return null;
}

describe("client/server boundary", () => {
  it("no client module imports an async component", () => {
    const violations = [];

    for (const [path, text] of source) {
      if (!isClient(text)) continue;
      for (const match of text.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
        const target = resolveAlias(match[1]);
        if (!target) continue;
        const targetText = source.get(target);
        if (isClient(targetText)) continue;
        if (exportsAsyncComponent(targetText)) {
          violations.push(`${path} imports async component from ${target}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });
});
