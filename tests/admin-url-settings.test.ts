/**
 * SEC-06 regression tests: positive URL-scheme validation for site settings
 * rendered as href / image URL sinks.
 *
 * The DB-side guard (`site_settings_no_script_check`, strengthened by
 * migration `20260803010000_site_settings_url_scheme_guard.sql`) is verified
 * separately against the live database. These tests exercise the *positive*
 * per-key check at `lib/admin/url-settings.ts` for the application boundary.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { validateSettingUrl, HREF_SETTING_KEYS, IMAGE_SETTING_KEYS } from "../lib/admin/url-settings.ts"

describe("SEC-06 site-setting URL validation", () => {
  describe("accepts intended values", () => {
    it("accepts same-origin relative path for href and image sinks", () => {
      assert.equal(validateSettingUrl("/blog/foo", "shop_banner_cta_href").ok, true)
      assert.equal(validateSettingUrl("/images/almonds.jpg", "seo_social_image").ok, true)
      assert.equal(validateSettingUrl("/shop", "shop_banner_image_url").ok, true)
    })

    it("accepts https URLs for href and image sinks", () => {
      assert.equal(validateSettingUrl("https://instagram.com/kabiaekolojik", "social_instagram").ok, true)
      assert.equal(validateSettingUrl("https://example.com/foo.png", "shop_banner_image_url").ok, true)
    })

    it("accepts mailto: and tel: for href sinks only", () => {
      assert.equal(validateSettingUrl("mailto:info@kabia.com", "shop_banner_cta_href").ok, true)
      assert.equal(validateSettingUrl("tel:+905537447674", "shop_banner_cta_href").ok, true)
    })

    it("accepts empty value (unset) for any URL-typed key", () => {
      for (const key of [...HREF_SETTING_KEYS, ...IMAGE_SETTING_KEYS]) {
        assert.equal(validateSettingUrl("", key).ok, true, `empty ${key} should pass`)
        assert.equal(validateSettingUrl("   ", key).ok, true, `whitespace-only ${key} should pass`)
      }
    })

    it("passes through non-URL keys unconstrained (the generic string schema is their arbiter)", () => {
      assert.equal(validateSettingUrl("store name", "store_name").ok, true)
      assert.equal(validateSettingUrl("Hafta içi 09:00 – 18:00", "support_hours").ok, true)
    })
  })

  describe("rejects dangerous schemes", () => {
    const cases: Array<[string, string]> = [
      ["data:", "data:text/html,<script>alert(1)</script>"],
      ["DATA:", "DATA:text/html,x"], // uppercase
      ["data: (whitespace)", "  data:text/html,x"], // leading whitespace
      ["data: (tab)", "\tdata:text/html,x"],
      ["javascript:", "javascript:alert(1)"],
      ["JS uppercase mixed", "JaVaScRiPt:alert(1)"],
      ["vbscript:", "vbscript:msgbox"],
      ["file:", "file:///etc/passwd"],
      ["blob:", "blob:https://example.com/abc"],
    ]
    for (const [label, payload] of cases) {
      it(`rejects ${label} for shop_banner_cta_href`, () => {
        const r = validateSettingUrl(payload, "shop_banner_cta_href")
        assert.equal(r.ok, false, `should reject ${label}`)
        assert.ok(r.reason, "should provide a Turkish reason")
      })
      it(`rejects ${label} for shop_banner_image_url`, () => {
        const r = validateSettingUrl(payload, "shop_banner_image_url")
        assert.equal(r.ok, false, `should reject ${label}`)
      })
    }
  })

  describe("rejects percent-encoded scheme bypasses", () => {
    it("rejects %64ata: (encoded data:)", () => {
      assert.equal(validateSettingUrl("%64ata:text/html,x", "shop_banner_cta_href").ok, false)
    })
    it("rejects %6aavascript: (encoded javascript:)", () => {
      assert.equal(validateSettingUrl("%6aavascript:alert(1)", "shop_banner_cta_href").ok, false)
    })
    it("rejects uppercase percent encoding", () => {
      assert.equal(validateSettingUrl("%44ATA:text/html,x", "shop_banner_cta_href").ok, false)
    })
  })

  describe("rejects protocol-relative URLs", () => {
    it("rejects //evil.com", () => {
      assert.equal(validateSettingUrl("//evil.com", "shop_banner_cta_href").ok, false)
    })
    it("rejects //evil.com with whitespace", () => {
      assert.equal(validateSettingUrl("   //evil.com", "shop_banner_cta_href").ok, false)
    })
    it("still accepts a same-origin relative path that starts with a single slash", () => {
      assert.equal(validateSettingUrl("/shop", "shop_banner_cta_href").ok, true)
    })
  })

  describe("rejects control characters", () => {
    it("rejects CR/LF/NUL/ESC injected into the value", () => {
      // Trim removes leading/trailing whitespace; the regex still must fire
      // when control chars appear mid-value.
      assert.equal(validateSettingUrl("https://ok.com/p\rath", "shop_banner_image_url").ok, false)
      assert.equal(validateSettingUrl("https://ok.com/p\nath", "shop_banner_image_url").ok, false)
      assert.equal(validateSettingUrl("https://ok.com/p\x00ath", "shop_banner_image_url").ok, false)
      assert.equal(validateSettingUrl("https://ok.com/p\x1b[31m", "shop_banner_image_url").ok, false)
    })
  })

  describe("rejects credential-bearing URLs", () => {
    it("rejects https://user:pass@host/", () => {
      assert.equal(validateSettingUrl("https://user:pass@evil.com/x", "social_instagram").ok, false)
    })
  })

  describe("rejects http: for image sinks (only https allowed)", () => {
    it("rejects http://example.com/foo.png for shop_banner_image_url", () => {
      assert.equal(validateSettingUrl("http://example.com/foo.png", "shop_banner_image_url").ok, false)
    })
    it("rejects http://example.com/foo for shop_banner_cta_href", () => {
      assert.equal(validateSettingUrl("http://example.com/foo", "shop_banner_cta_href").ok, false)
    })
  })

  describe("rejects malformed values", () => {
    it("rejects garbage that is not a URL", () => {
      assert.equal(validateSettingUrl("not a url at all", "shop_banner_image_url").ok, false)
    })
  })
})