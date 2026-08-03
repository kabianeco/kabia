import { defineConfig } from "@playwright/test"

/**
 * Configuration for the development-server stability suite.
 *
 * Unlike `playwright.config.ts`, this one starts no `webServer`: the suite
 * spawns `next dev` itself so it can read the dev server's own stdout and
 * assert that no cross-origin dev resource was ever blocked — the log line
 * that accompanies the refused Fast Refresh socket.
 *
 * The bundler is selected with `DEV_BUNDLER=webpack`; the default is
 * Turbopack, matching `npm run dev`.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "dev-server-stability.spec.ts",
  fullyParallel: false,
  workers: 1,
  // One test deliberately idles for longer than a full reload cycle.
  timeout: 240_000,
  expect: { timeout: 15_000 },
  use: {
    browserName: "chromium",
    trace: "retain-on-failure",
  },
})
