import { spawnSync } from "node:child_process";

// Explicitly reviewed pure/mocked suites. Existing npm test/config is untouched.
const files = [
  "admin-access", "admin-authorization", "admin-logging", "admin-url-settings",
  "auth-rate-limit", "order-state-machine", "security-headers", "shop-banner",
  "theme-engine-resolver", "theme-preview-cookie", "theme-editor-ui",
  "farm-content", "admin-nav", "brand-preview", "preview-identity", "preview-order-boundary", "store-listing",
  "affected-route-contracts",
].map(name => `tests/${name}.test.ts`);
files.push("tests/client-boundary.test.js");
const env = { ...process.env };
for (const key of Object.keys(env)) if (/SUPABASE|DATABASE_URL/.test(key)) delete env[key];
const result = spawnSync(process.execPath, [
  "--conditions=react-server", "--import", "./tests/alias-hook.mjs",
  "--import", "./tests/support/no-network.mjs", "--test", ...files,
], { stdio: "inherit", env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
