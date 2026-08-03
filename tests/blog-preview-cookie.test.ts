import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { createBlogPreviewToken, verifyBlogPreviewToken, getBlogPreviewSigningSecret } from "../lib/blog/preview-cookie.ts"
import { getAppearancePreviewSigningSecret } from "../lib/theme-engine/preview-cookie.ts"

const SECRET = "test-only-secret-with-at-least-thirty-two-bytes"
const USER_ID = "11111111-1111-1111-1111-111111111111"
const POST_ID = "22222222-2222-2222-2222-222222222222"
const NOW = 1_800_000_000_000

describe("blog preview cookie", () => {
  it("accepts an untampered, unexpired token only for the administrator and post it was issued for", () => {
    const token = createBlogPreviewToken({ userId: USER_ID, postId: POST_ID, now: NOW, ttlSeconds: 600, nonce: "fixed-nonce", secret: SECRET })

    assert.equal(
      verifyBlogPreviewToken(token, { userId: USER_ID, postId: POST_ID, now: NOW + 599_000, secret: SECRET }),
      true,
    )
  })

  it("rejects a token replayed against a different post", () => {
    const token = createBlogPreviewToken({ userId: USER_ID, postId: POST_ID, now: NOW, ttlSeconds: 600, nonce: "fixed-nonce", secret: SECRET })
    const otherPostId = "33333333-3333-3333-3333-333333333333"
    assert.equal(verifyBlogPreviewToken(token, { userId: USER_ID, postId: otherPostId, now: NOW, secret: SECRET }), false)
  })

  it("rejects a token replayed against a different administrator", () => {
    const token = createBlogPreviewToken({ userId: USER_ID, postId: POST_ID, now: NOW, ttlSeconds: 600, nonce: "fixed-nonce", secret: SECRET })
    const otherUserId = "44444444-4444-4444-4444-444444444444"
    assert.equal(verifyBlogPreviewToken(token, { userId: otherUserId, postId: POST_ID, now: NOW, secret: SECRET }), false)
  })

  it("rejects tampered, malformed, and expired tokens without throwing", () => {
    const token = createBlogPreviewToken({ userId: USER_ID, postId: POST_ID, now: NOW, ttlSeconds: 600, nonce: "fixed-nonce", secret: SECRET })

    assert.equal(verifyBlogPreviewToken(`${token}tampered`, { userId: USER_ID, postId: POST_ID, now: NOW, secret: SECRET }), false)
    assert.equal(verifyBlogPreviewToken("not-a-token", { userId: USER_ID, postId: POST_ID, now: NOW, secret: SECRET }), false)
    assert.equal(verifyBlogPreviewToken(token, { userId: USER_ID, postId: POST_ID, now: NOW + 600_001, secret: SECRET }), false)
    assert.equal(verifyBlogPreviewToken(undefined, { userId: USER_ID, postId: POST_ID, now: NOW, secret: SECRET }), false)
  })

  it("never verifies with an empty secret (signing unavailable)", () => {
    const token = createBlogPreviewToken({ userId: USER_ID, postId: POST_ID, now: NOW, ttlSeconds: 600, nonce: "fixed-nonce", secret: SECRET })
    assert.equal(verifyBlogPreviewToken(token, { userId: USER_ID, postId: POST_ID, now: NOW, secret: "" }), false)
  })
})

describe("blog vs appearance preview signing separation", () => {
  it("derives a different signing secret from the same service-role key", () => {
    const original = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = "shared-service-role-key-for-this-test-only"
    try {
      const blogSecret = getBlogPreviewSigningSecret()
      const appearanceSecret = getAppearancePreviewSigningSecret()
      assert.ok(blogSecret)
      assert.ok(appearanceSecret)
      assert.notEqual(blogSecret, appearanceSecret)
    } finally {
      if (original === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
      else process.env.SUPABASE_SERVICE_ROLE_KEY = original
    }
  })

  it("a token signed for blog preview does not verify against the appearance secret derivation, and vice versa", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "shared-service-role-key-for-this-test-only-2"
    try {
      const blogSecret = getBlogPreviewSigningSecret()
      const appearanceSecret = getAppearancePreviewSigningSecret()
      const blogToken = createBlogPreviewToken({ userId: USER_ID, postId: POST_ID, now: NOW, secret: blogSecret ?? "" })
      assert.equal(
        verifyBlogPreviewToken(blogToken, { userId: USER_ID, postId: POST_ID, now: NOW, secret: appearanceSecret ?? "" }),
        false,
      )
    } finally {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })
})
