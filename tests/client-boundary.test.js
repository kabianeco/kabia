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

/**
 * A value exported from a `"use client"` module reaches a server module as a
 * client reference, not as the value. Rendered into <head> (the theme boot
 * script), that reference made hydration wait on a layout chunk; when the chunk
 * arrived late, React left its hydration cursor inside <head> and threw #418 on
 * the first <body> child. Server modules may import components (PascalCase)
 * and types from client modules — plain values belong in a shared module.
 */
describe("client references in server modules", () => {
  it("server modules import only components and types from client modules", () => {
    const violations = [];

    for (const [path, text] of source) {
      if (isClient(text)) continue;
      for (const match of text.matchAll(/import\s+(?!type\s)\{([^}]*)\}\s*from\s+["'](@\/[^"']+)["']/g)) {
        const target = resolveAlias(match[2]);
        if (!target || !isClient(source.get(target))) continue;
        for (const raw of match[1].split(",")) {
          const spec = raw.trim();
          if (!spec || spec.startsWith("type ")) continue;
          const imported = spec.split(/\s+as\s+/)[0].trim();
          if (!/^[A-Z][A-Za-z0-9]*$/.test(imported) || /^[A-Z0-9_]+$/.test(imported)) {
            violations.push(`${path} imports value "${imported}" from client module ${target}`);
          }
        }
      }
    }

    assert.deepEqual(violations, []);
  });
});
