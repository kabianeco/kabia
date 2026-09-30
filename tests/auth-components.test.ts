import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  CODE_LENGTH, digitsFrom, emptyDigits, enterDigits, eraseDigit, isValidCode, joinDigits, typedText,
} from "../lib/auth/code.ts"
import {
  PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, STRENGTH_TEXT, newPasswordField, passwordStrength,
} from "../lib/auth/password-policy.ts"
import { cooldownText, remainingSeconds, RESEND_COOLDOWN_SECONDS } from "../lib/auth/pending.ts"
import { parseRegistration, TERMS_REQUIRED } from "../lib/auth/registration.ts"
import { CONSENT_VERSIONS } from "../lib/auth/consent.ts"
import { issueFlowMarker, verifyFlowMarker } from "../lib/auth/flow-marker.ts"
import { validateSignupCode } from "../lib/auth/customer-confirm.ts"
import { buildExport } from "../lib/account/export.ts"
import { reorderMessage } from "../lib/account/reorder.ts"
import { ORDER_RECORD_RETENTION_YEARS } from "../lib/account/retention.ts"
import { isAccountSurface } from "../lib/site.ts"

const read = (path: string) => readFileSync(path, "utf8")

describe("verification code (one constant for UI and server)", () => {
  it("is six digits and validated strictly on the server", () => {
    assert.equal(CODE_LENGTH, 6)
    assert.equal(isValidCode("012345"), true)
    for (const bad of ["12345", "1234567", "12 345", "１２３４５６", "abcdef", ""]) assert.equal(isValidCode(bad), false, bad)
    assert.equal(validateSignupCode("a@b.co", "123456")?.token, "123456")
    assert.equal(validateSignupCode("a@b.co", "123 456"), null)
  })

  it("typing advances, a full paste fills every box from the first", () => {
    let state = enterDigits(emptyDigits(), 0, "4")
    assert.deepEqual(state, { digits: ["4", "", "", "", "", ""], focus: 1 })
    state = enterDigits(state.digits, 3, "123456")
    assert.deepEqual(state, { digits: ["1", "2", "3", "4", "5", "6"], focus: 5 })
    assert.equal(joinDigits(state.digits), "123456")
    // A partial paste fills forward from the box it landed in.
    assert.deepEqual(enterDigits(emptyDigits(), 2, "78"), { digits: ["", "", "7", "8", "", ""], focus: 4 })
    // Non-digits are ignored; nothing changes.
    assert.deepEqual(enterDigits(emptyDigits(), 1, "x"), { digits: emptyDigits(), focus: 1 })
  })

  it("backspace clears the box, or steps back and clears the previous one", () => {
    assert.deepEqual(eraseDigit(["1", "2", "", "", "", ""], 1), { digits: ["1", "", "", "", "", ""], focus: 1 })
    assert.deepEqual(eraseDigit(["1", "2", "", "", "", ""], 2), { digits: ["1", "", "", "", "", ""], focus: 1 })
    assert.deepEqual(eraseDigit(emptyDigits(), 0), { digits: emptyDigits(), focus: 0 })
  })

  it("overtyping a filled box keeps only the new digit; autofill stays whole", () => {
    assert.equal(typedText("3", "35"), "5")
    assert.equal(typedText("3", "53"), "5")
    assert.equal(typedText("1", "123456"), "123456")
    assert.equal(typedText("", "7"), "7")
    assert.equal(digitsFrom("Kod: 123 456"), "123456")
  })

  it("the component wires numeric input, one-time-code autofill and a labelled group", () => {
    const src = read("components/auth/code-input.tsx")
    assert.match(src, /inputMode="numeric"/)
    assert.match(src, /"one-time-code"/)
    assert.match(src, /role="group"/)
    assert.match(src, /aria-labelledby=\{labelId\}/)
    assert.match(src, /CODE_LENGTH/)
    assert.match(src, /type="hidden" name=\{name\}/)
    for (const key of ["Backspace", "ArrowLeft", "ArrowRight", "Home", "End"]) assert.ok(src.includes(`"${key}"`), key)
  })
})

describe("password policy (8 everywhere)", () => {
  it("one minimum and bcrypt-safe maximum", () => {
    assert.equal(PASSWORD_MIN_LENGTH, 8)
    assert.equal(PASSWORD_MAX_LENGTH, 72)
    assert.equal(newPasswordField.safeParse("1234567").success, false)
    assert.equal(newPasswordField.safeParse("12345678").success, true)
    assert.equal(newPasswordField.safeParse("x".repeat(73)).success, false)
  })

  it("strength is guidance, never stricter than the rule", () => {
    assert.equal(passwordStrength(""), "empty")
    assert.equal(passwordStrength("abc"), "short")
    assert.equal(passwordStrength("12345678"), "weak")
    assert.equal(passwordStrength("aaaaaaaaaa"), "weak")
    assert.equal(passwordStrength("bahcedeki"), "weak")
    assert.equal(passwordStrength("bahcedeki9"), "fair")
    assert.equal(passwordStrength("Bahçe-Badem-9"), "good")
    assert.equal(passwordStrength("uzun bir cumle gibi"), "good")
    assert.equal(newPasswordField.safeParse("12345678").success, true, "a weak hint does not block")
    assert.ok(STRENGTH_TEXT.short.includes("8"))
  })

  it("no form or server schema keeps the old 6-character rule", () => {
    for (const file of [
      "app/auth/actions.ts", "components/auth/register-form.tsx", "components/auth/new-password-form.tsx",
      "app/hesabim/guvenlik/page.tsx", "lib/account/handlers.ts", "lib/auth/registration.ts",
    ]) {
      const src = read(file)
      assert.ok(!/min\(6|en az 6|6 karakter|minLength=\{6\}/i.test(src), file)
    }
  })

  it("the field offers show/hide with an accessible name", () => {
    const src = read("components/auth/password-field.tsx")
    assert.match(src, /"Şifreyi göster"/)
    assert.match(src, /"Şifreyi gizle"/)
    assert.match(src, /aria-controls=\{id\}/)
  })
})

describe("resend cooldown", () => {
  it("counts whole seconds down from 60 and never above it", () => {
    assert.equal(RESEND_COOLDOWN_SECONDS, 60)
    assert.equal(remainingSeconds(10_000 + 30_000, 10_000), 30)
    assert.equal(remainingSeconds(10_000 + 29_001, 10_000), 30)
    assert.equal(remainingSeconds(5_000, 10_000), 0)
    assert.equal(remainingSeconds(Number.NaN, 10_000), 0)
    assert.equal(remainingSeconds(10_000 + 600_000, 10_000), 60)
    assert.equal(cooldownText(30), "30 sn sonra tekrar gönderebilirsiniz")
  })

  it("resend is a quiet text line, not a button-styled control", () => {
    const src = read("components/auth/resend-line.tsx")
    assert.ok(!src.includes("<Button"))
    assert.match(src, /Tekrar gönder/)
    assert.match(src, /aria-live="polite"/)
    const code = read("components/auth/verification-code-form.tsx")
    assert.match(code, /prompt="Kod gelmedi mi\?"/)
  })

  it("registration starts the cooldown as soon as the code is sent", () => {
    assert.match(read("components/auth/register-form.tsx"), /startResendCooldown\("signup"\)/)
  })
})

describe("registration (server-side consents)", () => {
  const base = { name: "Ayşe Yılmaz", email: "Ayse@Example.com", phone: "0555 000 00 00", password: "bahce-badem-9" }

  it("requires terms and KVKK on the server and records versions", () => {
    const ok = parseRegistration({ ...base, terms: "on", kvkk: "on" })
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.equal(ok.email, "ayse@example.com")
      assert.deepEqual(ok.metadata.consents, {
        terms: CONSENT_VERSIONS.terms, kvkk: CONSENT_VERSIONS.kvkk, marketing: false, explicit_consent: CONSENT_VERSIONS.explicitConsent,
      })
    }
    for (const missing of [{ terms: "on" }, { kvkk: "on" }, {}, { terms: "true", kvkk: "on" }]) {
      const result = parseRegistration({ ...base, ...missing })
      assert.equal(result.ok, false)
      if (!result.ok) assert.equal(result.fieldErrors.consents, TERMS_REQUIRED)
    }
  })

  it("persists the optional marketing choice, default off", () => {
    const yes = parseRegistration({ ...base, terms: "on", kvkk: "on", marketing: "on" })
    assert.equal(yes.ok && yes.metadata.consents.marketing, true)
  })

  it("puts each problem on its own field", () => {
    const result = parseRegistration({ name: "A", email: "x", phone: "1", password: "short", terms: "on", kvkk: "on" })
    assert.equal(result.ok, false)
    if (!result.ok) assert.deepEqual(Object.keys(result.fieldErrors).sort(), ["email", "name", "password", "phone"])
  })

  it("the action signs up with the parsed metadata only", () => {
    const src = read("app/auth/actions.ts")
    assert.match(src, /parseRegistration\(/)
    assert.match(src, /options: \{ data: parsed\.metadata \}/)
    assert.match(src, /checkRateLimit\("registration"/)
  })
})

describe("flow markers for status pages", () => {
  it("are bound to purpose and subject and expire", () => {
    const now = 1_800_000_000_000
    const marker = issueFlowMarker("email_change", "link", now)
    assert.equal(verifyFlowMarker(marker, "email_change", "link", now + 1000), true)
    assert.equal(verifyFlowMarker(marker, "account_deleted", "link", now + 1000), false)
    assert.equal(verifyFlowMarker(marker, "email_change", "other", now + 1000), false)
    assert.equal(verifyFlowMarker(marker, "email_change", "link", now + 11 * 60 * 1000), false)
    assert.equal(verifyFlowMarker(`${marker}0`, "email_change", "link", now + 1000), false)
    assert.equal(verifyFlowMarker(undefined, "email_change", "link", now), false)
  })

  it("the pages redirect without a valid marker", () => {
    assert.match(read("app/eposta-degisikligi-onaylandi/page.tsx"), /verifyFlowMarker\([\s\S]*redirect\(/)
    assert.match(read("app/hesap-silindi/page.tsx"), /verifyFlowMarker\([\s\S]*redirect\(/)
    assert.match(read("app/auth/confirm/route.ts"), /issueFlowMarker\("email_change"/)
  })
})

describe("status screens", () => {
  it("one shared frame, no auto-redirect, no boxed icons", () => {
    const src = read("components/auth/status-screen.tsx")
    assert.ok(!/<svg|border rounded|rounded-full border/.test(src))
    for (const page of ["app/eposta-onaylandi/page.tsx", "app/baglanti-gecersiz/page.tsx", "app/hesap-silindi/page.tsx", "app/eposta-degisikligi-onaylandi/page.tsx"]) {
      const s = read(page)
      assert.match(s, /StatusScreen/, page)
      assert.ok(!/TimedRedirect|setTimeout/.test(s), page)
    }
  })
})

describe("data export document", () => {
  it("has a manifest, the retention note and never includes secrets", () => {
    const doc = buildExport(
      {
        account: { id: "u", email: "a@b.co" },
        profile: { full_name: "A", encrypted_password: "x" },
        addresses: [],
        notificationPreferences: null,
        consents: [],
        favorites: [],
        reviews: [],
        savedCardMetadata: [],
        orders: [{ order_number: "KB-1", refresh_token: "t", items: [{ access_token: "t", name: "Bal" }] }],
      },
      new Date("2026-09-26T00:00:00Z"),
    ) as Record<string, unknown>
    const text = JSON.stringify(doc)
    for (const secret of ["encrypted_password", "refresh_token", "access_token"]) assert.ok(!text.includes(secret), secret)
    const manifest = doc.manifest as Record<string, unknown>
    assert.equal(manifest.generated_at, "2026-09-26T00:00:00.000Z")
    assert.match(String(manifest.retention_note), new RegExp(`${ORDER_RECORD_RETENTION_YEARS} yıl`))
    assert.ok(text.includes("Bal"))
  })
})

describe("reorder message", () => {
  it("says exactly how many items went back to the cart", () => {
    assert.deepEqual(reorderMessage(3, 3), { ok: true, text: "3 ürün sepete eklendi." })
    assert.deepEqual(reorderMessage(3, 2), { ok: true, text: "3 ürünün 2 tanesi sepete eklendi; 1 ürün artık satışta değil." })
    assert.equal(reorderMessage(2, 0).ok, false)
  })
})

describe("route-scoped toasts", () => {
  it("covers auth and account routes only", () => {
    for (const path of ["/giris", "/kayit", "/dogrulama-kodu", "/eposta-onay-bekleniyor", "/sifremi-unuttum", "/sifre-yenile", "/hesabim", "/hesabim/guvenlik/hesabi-sil", "/hesap-silindi"]) {
      assert.equal(isAccountSurface(path), true, path)
    }
    for (const path of ["/", "/magaza", "/shop/cicek-bali", "/sepet", "/odeme", "/hesabimx", "/iletisim", null]) {
      assert.equal(isAccountSurface(path), false, String(path))
    }
  })

  it("the toast offsets keep their desktop values and clear the home indicator", () => {
    const src = read("components/providers.tsx")
    assert.match(src, /accountSurface \? 96 : 24/)
    assert.match(src, /var\(--safe-bottom\)/)
  })
})

describe("account area wiring", () => {
  it("ordinary logout is local; global sign-out lives behind the password", () => {
    assert.match(read("lib/auth-context.tsx"), /signOut\(\{ scope: "local" \}\)/)
    assert.match(read("lib/account/server-deps.ts"), /signOut\(\{ scope: "global" \}\)/)
  })

  it("saved-card entry is gone and nothing writes payment_methods", () => {
    const nav = read("components/account/account-nav.tsx")
    assert.ok(!nav.includes("kart-bilgilerim"))
    assert.ok(!/from\("payment_methods"\)/.test(read("lib/cards-context.tsx")))
    assert.ok(!/<input|<form|cardNumber/.test(read("app/hesabim/kart-bilgilerim/page.tsx")), "no card entry on the old URL")
  })

  it("the mobile nav cell cannot widen the page", () => {
    assert.match(read("components/account/account-guard.tsx"), /className="min-w-0 lg:col-span-3"/)
  })

  it("every account action goes through handlers with the limiter buckets", () => {
    const actions = read("app/hesabim/actions.ts")
    for (const name of ["changePassword", "changeEmail", "signOutEverywhere", "exportData", "deleteAccount", "updateProfile", "setMarketingConsent"]) {
      assert.match(actions, new RegExp(`${name}\\(formObject\\(formData\\)`), name)
    }
    const limiter = read("lib/auth/rate-limit.ts")
    assert.match(limiter, /account_reauth: "closed"/)
    assert.match(limiter, /account_update: "open"/)
  })

  it("password proof uses an isolated, non-persisting client", () => {
    const src = read("lib/account/server-deps.ts")
    assert.match(src, /persistSession: false/)
    assert.match(src, /signOut\(\{ scope: "local" \}\)/)
  })

  it("retention is one named constant, and nothing purges", () => {
    assert.equal(typeof ORDER_RECORD_RETENTION_YEARS, "number")
    assert.match(read("lib/account/retention.ts"), /PENDING OWNER DECISION/)
  })
})

describe("Phase 2 migrations", () => {
  const m = (name: string) => read(`supabase/migrations/${name}`)

  it("create_order: consents required and true, anon revoked", () => {
    const sql = m("20260926002000_create_order_required_consents.sql")
    assert.match(sql, /p_consented_sales boolean, p_consented_kvkk boolean, p_card_last4 text DEFAULT/)
    assert.match(sql, /p_consented_sales is not true or p_consented_kvkk is not true/)
    assert.match(sql, /revoke all on function public\.create_order\([^)]*\) from public, anon/)
  })

  it("reviews: no blanket read; invoker view without user_id", () => {
    const sql = m("20260926002100_reviews_invoker_projection.sql")
    assert.match(sql, /drop policy if exists reviews_public_read/)
    assert.match(sql, /with \(security_invoker = true\)/)
    assert.ok(!/grant select \([^)]*user_id/.test(sql))
  })

  it("orders survive account deletion; only the nested FK action may detach", () => {
    const sql = m("20260926002400_order_retention_on_account_deletion.sql")
    assert.match(sql, /on delete set null/)
    assert.match(sql, /pg_trigger_depth\(\) > 1/)
    assert.match(sql, /customer_detached_at/)
    assert.ok(!/delete from public\.orders/i.test(sql))
  })

  it("consents recorded; campaign e-mail defaults off", () => {
    const sql = m("20260926002500_customer_consents.sql")
    assert.match(sql, /campaign_emails set default false/)
    assert.match(sql, /set_marketing_email_consent/)
    assert.match(sql, /from public, anon/)
  })
})
