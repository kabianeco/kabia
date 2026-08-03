/**
 * Resolve hook so `node --test` can import the app's TypeScript modules.
 *
 * Two gaps to bridge:
 *   1. the `@/…` path alias from tsconfig, which Node knows nothing about;
 *   2. extensionless specifiers, which are normal in TypeScript but not valid
 *      ESM — `@/lib/admin/roles` has to become `…/lib/admin/roles.ts`.
 *
 * Node 22.6+ strips the types itself, so no transpiler is involved. `.tsx` is
 * deliberately not in the candidate list: Node does not transform JSX, and any
 * module a unit test needs should be free of it anyway.
 *
 * Registered with `--import ./tests/alias-hook.mjs`.
 */

import { registerHooks } from "node:module"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Extensionless → the first candidate that exists on disk. */
function withExtension(absolutePath) {
  if (path.extname(absolutePath)) return absolutePath
  for (const candidate of [
    `${absolutePath}.ts`,
    `${absolutePath}.mts`,
    `${absolutePath}.js`,
    path.join(absolutePath, "index.ts"),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return absolutePath
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Next's package exposes this entrypoint to bundlers without a file
    // extension, while Node's native ESM resolver requires the concrete file.
    if (specifier === "next/cache") {
      return nextResolve("next/cache.js", context)
    }
    if (specifier.startsWith("@/")) {
      const resolved = withExtension(path.join(root, specifier.slice(2)))
      return nextResolve(pathToFileURL(resolved).href, context)
    }
    return nextResolve(specifier, context)
  },
})
