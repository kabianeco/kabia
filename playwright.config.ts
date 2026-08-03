import { defineConfig } from "@playwright/test"

const port = Number(process.env.AFFECTED_ROUTES_PORT ?? 3412)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./tests",
  testMatch: "affected-routes.production.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    // NODE_ENV=production is explicit so the development-only canonical-origin
    // redirect in proxy.ts never fires during these production tests.
    command: `NODE_ENV=production npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
})
