import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  unsafeCreateAppearancePreviewTokenWithSecret as createAppearancePreviewToken,
  unsafeVerifyAppearancePreviewTokenWithSecret as verifyAppearancePreviewToken,
} from "../lib/theme-engine/preview-cookie.ts"

const SECRET = "test-only-secret-with-at-least-thirty-two-bytes"
const USER_ID = "11111111-1111-1111-1111-111111111111"
const NOW = 1_800_000_000_000

describe("appearance preview cookie", () => {
  it("accepts an untampered, unexpired token only for the administrator that requested it", () => {
    const token = createAppearancePreviewToken({
      userId: USER_ID,
      now: NOW,
      ttlSeconds: 600,
      nonce: "fixed-test-nonce",
      secret: SECRET,
    })

    assert.equal(
      verifyAppearancePreviewToken(token, {
        userId: USER_ID,
        now: NOW + 599_000,
        secret: SECRET,
      }),
      true,
    )
    assert.equal(
      verifyAppearancePreviewToken(token, {
        userId: "22222222-2222-2222-2222-222222222222",
        now: NOW,
        secret: SECRET,
      }),
      false,
    )
  })

  it("rejects tampered, malformed, and expired tokens without throwing", () => {
    const token = createAppearancePreviewToken({
      userId: USER_ID,
      now: NOW,
      ttlSeconds: 600,
      nonce: "fixed-test-nonce",
      secret: SECRET,
    })

    assert.equal(
      verifyAppearancePreviewToken(`${token}tampered`, {
        userId: USER_ID,
        now: NOW,
        secret: SECRET,
      }),
      false,
    )
    assert.equal(
      verifyAppearancePreviewToken("not-a-token", {
        userId: USER_ID,
        now: NOW,
        secret: SECRET,
      }),
      false,
    )
    assert.equal(
      verifyAppearancePreviewToken(token, {
        userId: USER_ID,
        now: NOW + 600_001,
        secret: SECRET,
      }),
      false,
    )
  })
})

describe("S27 — production signatures take no caller secret", () => {
  it("option types no longer accept secret", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("lib/theme-engine/preview-cookie.ts", "utf8")
    assert.match(src, /import "server-only"/)
    assert.ok(!src.includes("secret?: string"), "caller override removed")
    assert.match(src, /unsafeCreateAppearancePreviewTokenWithSecret/)
    assert.match(src, /unsafeVerifyAppearancePreviewTokenWithSecret/)
  })

  it("no production caller passes a secret", async () => {
    const { execSync } = await import("node:child_process")
    const hits = execSync(
      "grep -rn 'createAppearancePreviewToken(\\|verifyAppearancePreviewToken(' app lib components --include='*.ts' --include='*.tsx' | grep -v unsafe | grep -v 'lib/theme-engine/preview-cookie.ts'",
    )
      .toString()
      .trim()
    for (const line of hits.split("\n")) {
      assert.ok(!line.includes("secret"), `caller passes secret: ${line}`)
    }
  })
})
