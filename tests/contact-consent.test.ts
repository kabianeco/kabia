import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// S20 + §5.1: unthrottled writes closed, KVKK consent required + recorded.
// The live rate-limit behavior needs a session; wiring is pinned here.

describe("sendContactMessage", () => {
  const src = readFileSync("app/iletisim/actions.ts", "utf8");

  it("requires KVKK consent server-side", () => {
    assert.match(src, /kvkk: z\.literal\("1"/);
    assert.match(src, /kvkk: formData\.get\("kvkk"\)/);
  });

  it("rate-limits per IP + email with a generic failure", () => {
    assert.match(src, /checkRateLimit\("contact_notify", getClientIp\(h\), parsed\.data\.email\)/);
    assert.ok(!src.includes("limit aşıldı") || src.includes('console.error("[iletisim] contact_notify limit aşıldı.")'));
  });

  it("records consent with a server timestamp", () => {
    assert.match(src, /consent_kvkk: true/);
    assert.match(src, /consent_kvkk_at: new Date\(\)\.toISOString\(\)/);
  });

  it("keeps the generic success message", () => {
    assert.match(src, /Mesajınız bize ulaştı\. En kısa sürede döneceğiz\./);
  });
});

describe("consent checkbox (approved visible change §5.1)", () => {
  it("notify form links KVKK + explicit consent", () => {
    const src = readFileSync("components/home/notify-form.tsx", "utf8");
    assert.match(src, /name="kvkk"/);
    assert.match(src, /routes\.kvkkDisclosure/);
    assert.match(src, /routes\.explicitConsent/);
  });

  it("contact form links KVKK + privacy policy", () => {
    const src = readFileSync("components/contact/contact-form.tsx", "utf8");
    assert.match(src, /name="kvkk"/);
    assert.match(src, /routes\.kvkkDisclosure/);
    assert.match(src, /routes\.privacyPolicy/);
  });

  it("migration adds the consent columns", () => {
    const sql = readFileSync("supabase/migrations/20260926001400_contact_consent_columns.sql", "utf8");
    assert.match(sql, /consent_kvkk boolean/);
    assert.match(sql, /consent_kvkk_at timestamptz/);
  });
});
