import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  ACCOUNT_DELETED_PATH,
  EMAIL_CHANGE_SENT,
  MESSAGES,
  SIGNED_OUT_EVERYWHERE_PATH,
  changeEmail,
  changePassword,
  deleteAccount,
  exportData,
  exportFilename,
  formObject,
  setMarketingConsent,
  signOutEverywhere,
  updateProfile,
  type Bucket,
  type SessionUser,
} from "../lib/account/handlers.ts"
import { RATE_LIMIT_MESSAGE } from "../lib/auth/rate-limit-message.ts"

// Every signed-in account action, database-free: real Supabase clients and the
// limiter are replaced by recording fakes. These cover the flows that must not
// be exercised on a real account (deletion, password/e-mail change, sign-out
// everywhere) — including their order of checks.

const USER: SessionUser = { id: "user-1", email: "musteri@example.com", hasPassword: true }

function fakes(overrides: Record<string, unknown> = {}) {
  const calls: string[] = []
  const deps = {
    calls,
    async getUser() { calls.push("getUser"); return USER as SessionUser | null },
    async allow(bucket: Bucket, key: string) { calls.push(`allow:${bucket}:${key}`); return true },
    async verifyPassword(email: string, password: string) { calls.push(`verify:${email}`); return password === "dogru-sifre" },
    async updatePassword(_email: string, current: string) { calls.push("updatePassword"); return current === "dogru-sifre" ? "ok" as const : "invalid_current" as const },
    async requestEmailChange(email: string) { calls.push(`emailChange:${email}`); return "ok" as const },
    async signOutGlobal() { calls.push("signOutGlobal"); return true },
    async collect() { calls.push("collect"); return { manifest: {} } },
    async hasStaffRole() { calls.push("hasStaffRole"); return false },
    async removeAccountContent() { calls.push("removeContent"); return true },
    async deleteAuthUser() { calls.push("deleteAuthUser"); return true },
    async saveProfile() { calls.push("saveProfile"); return true },
    async setMarketingConsent(granted: boolean) { calls.push(`marketing:${granted}`); return true },
    ...overrides,
  }
  return deps
}

const signedOut = { getUser: async () => null }
const limited = { allow: async () => false }

describe("password change", () => {
  const good = { currentPassword: "dogru-sifre", newPassword: "yeni-uzun-sifre" }

  it("succeeds only through the proved update, after the limiter", async () => {
    const deps = fakes()
    const result = await changePassword(good, deps)
    assert.equal(result.ok, true)
    assert.deepEqual(deps.calls, ["getUser", "allow:account_reauth:user-1", "updatePassword"])
  })

  it("rejects a wrong current password on its field", async () => {
    const result = await changePassword({ ...good, currentPassword: "yanlis" }, fakes())
    assert.equal(result.ok, false)
    assert.equal(result.fieldErrors?.currentPassword, MESSAGES.wrongPassword)
  })

  it("enforces 8 characters and a different password before spending an attempt", async () => {
    const deps = fakes()
    const short = await changePassword({ ...good, newPassword: "kisa7ch" }, deps)
    assert.match(short.fieldErrors?.newPassword ?? "", /en az 8/)
    const same = await changePassword({ currentPassword: "ayni-sifre-1", newPassword: "ayni-sifre-1" }, deps)
    assert.match(same.fieldErrors?.newPassword ?? "", /farklı/)
    assert.ok(!deps.calls.some((c) => c.startsWith("allow")), "validation runs before the limiter")
  })

  it("maps weak/same/error outcomes and never leaks provider text", async () => {
    for (const outcome of ["weak", "same", "error"] as const) {
      const result = await changePassword(good, fakes({ updatePassword: async () => outcome }))
      assert.equal(result.ok, false)
      assert.ok(!/supabase|gotrue|password_/i.test(result.message ?? ""))
    }
  })

  it("stops when signed out, rate limited, or the account has no password", async () => {
    assert.equal((await changePassword(good, fakes(signedOut))).message, MESSAGES.signedOut)
    const rl = fakes(limited)
    assert.equal((await changePassword(good, rl)).message, RATE_LIMIT_MESSAGE)
    assert.ok(!rl.calls.includes("updatePassword"))
    const oauth = fakes({ getUser: async () => ({ ...USER, hasPassword: false }) })
    assert.equal((await changePassword(good, oauth)).message, MESSAGES.noPassword)
    assert.ok(!oauth.calls.includes("updatePassword"))
  })
})

describe("e-mail change", () => {
  const good = { newEmail: " Yeni@Example.com ", currentPassword: "dogru-sifre" }

  it("requires the current password, then requests the change with a normalized address", async () => {
    const deps = fakes()
    const result = await changeEmail(good, deps)
    assert.deepEqual(result, { ok: true, message: EMAIL_CHANGE_SENT })
    assert.deepEqual(deps.calls, ["getUser", "allow:account_reauth:user-1", "verify:musteri@example.com", "emailChange:yeni@example.com"])
  })

  it("says the same thing whether or not the address is taken (no enumeration)", async () => {
    const taken = await changeEmail(good, fakes({ requestEmailChange: async () => "exists" }))
    const free = await changeEmail(good, fakes())
    assert.deepEqual(taken, free)
  })

  it("does not call Supabase on a wrong password or the same address", async () => {
    const wrong = fakes()
    await changeEmail({ ...good, currentPassword: "yanlis" }, wrong)
    assert.ok(!wrong.calls.some((c) => c.startsWith("emailChange")))
    const same = await changeEmail({ ...good, newEmail: USER.email }, fakes())
    assert.equal(same.ok, false)
    assert.ok(same.fieldErrors?.newEmail)
  })

  it("reports a genuine failure generically", async () => {
    const result = await changeEmail(good, fakes({ requestEmailChange: async () => "error" }))
    assert.deepEqual(result, { ok: false, message: MESSAGES.generic })
  })
})

describe("sign out of all devices", () => {
  it("re-checks the password, signs out globally and sends the visitor to login", async () => {
    const deps = fakes()
    const result = await signOutEverywhere({ currentPassword: "dogru-sifre" }, deps)
    assert.deepEqual(result, { ok: true, redirectTo: SIGNED_OUT_EVERYWHERE_PATH })
    assert.deepEqual(deps.calls.slice(-2), ["verify:musteri@example.com", "signOutGlobal"])
  })

  it("never signs out on a wrong password, a missing password or when limited", async () => {
    for (const [input, extra] of [
      [{ currentPassword: "yanlis" }, {}],
      [{ currentPassword: "" }, {}],
      [{ currentPassword: "dogru-sifre" }, limited],
    ] as const) {
      const deps = fakes(extra)
      const result = await signOutEverywhere(input, deps)
      assert.equal(result.ok, false)
      assert.ok(!deps.calls.includes("signOutGlobal"))
    }
  })

  it("reports a failed global sign-out", async () => {
    const result = await signOutEverywhere({ currentPassword: "dogru-sifre" }, fakes({ signOutGlobal: async () => false }))
    assert.equal(result.ok, false)
  })
})

describe("personal data export", () => {
  it("returns a JSON document and a dated filename after the password check", async () => {
    const deps = fakes()
    const result = await exportData({ currentPassword: "dogru-sifre" }, deps, new Date("2026-09-26T10:00:00Z"))
    assert.equal(result.ok, true)
    assert.equal(result.filename, "kabia-verilerim-2026-09-26.json")
    assert.deepEqual(JSON.parse(result.data ?? ""), { manifest: {} })
    assert.deepEqual(deps.calls.slice(-2), ["verify:musteri@example.com", "collect"])
  })

  it("collects nothing without the password", async () => {
    const deps = fakes()
    const result = await exportData({ currentPassword: "yanlis" }, deps)
    assert.equal(result.ok, false)
    assert.equal(result.data, undefined)
    assert.ok(!deps.calls.includes("collect"))
  })

  it("says so when the data cannot be gathered", async () => {
    const result = await exportData({ currentPassword: "dogru-sifre" }, fakes({ collect: async () => null }))
    assert.equal(result.ok, false)
  })

  it("filename is date-only", () => {
    assert.equal(exportFilename(new Date("2027-01-02T23:59:00Z")), "kabia-verilerim-2027-01-02.json")
  })
})

describe("account deletion", () => {
  const good = { currentPassword: "dogru-sifre", confirm: "on" }

  it("deletes content, then the Auth user, and lands on the deleted page", async () => {
    const deps = fakes()
    const result = await deleteAccount(good, deps)
    assert.deepEqual(result, { ok: true, redirectTo: ACCOUNT_DELETED_PATH })
    assert.deepEqual(deps.calls, [
      "getUser", "allow:account_reauth:user-1", "verify:musteri@example.com",
      "hasStaffRole", "removeContent", "deleteAuthUser",
    ])
  })

  it("requires the explicit confirmation and the password", async () => {
    const unconfirmed = fakes()
    const r1 = await deleteAccount({ currentPassword: "dogru-sifre" }, unconfirmed)
    assert.ok(r1.fieldErrors?.confirm)
    assert.ok(!unconfirmed.calls.includes("deleteAuthUser"))
    const wrong = fakes()
    await deleteAccount({ ...good, currentPassword: "yanlis" }, wrong)
    assert.ok(!wrong.calls.includes("deleteAuthUser") && !wrong.calls.includes("removeContent"))
  })

  it("never deletes an account that holds (or may hold) a staff role", async () => {
    const deps = fakes({ hasStaffRole: async () => true })
    const result = await deleteAccount(good, deps)
    assert.equal(result.ok, false)
    assert.ok(!deps.calls.includes("removeContent") && !deps.calls.includes("deleteAuthUser"))
  })

  it("stops before the Auth deletion if content removal fails, and reports Auth failure", async () => {
    const contentFails = fakes({ removeAccountContent: async () => false })
    assert.equal((await deleteAccount(good, contentFails)).ok, false)
    assert.ok(!contentFails.calls.includes("deleteAuthUser"))
    assert.equal((await deleteAccount(good, fakes({ deleteAuthUser: async () => false }))).ok, false)
  })

  it("is rate limited and requires a session", async () => {
    assert.equal((await deleteAccount(good, fakes(limited))).message, RATE_LIMIT_MESSAGE)
    assert.equal((await deleteAccount(good, fakes(signedOut))).message, MESSAGES.signedOut)
  })
})

describe("profile", () => {
  it("saves a trimmed profile with nulls for empty optional fields", async () => {
    let saved: unknown
    const result = await updateProfile(
      { name: "  Ayşe Yılmaz ", phone: "", birthDate: "" },
      fakes({ saveProfile: async (_id: string, patch: unknown) => { saved = patch; return true } }),
    )
    assert.equal(result.ok, true)
    assert.deepEqual(saved, { full_name: "Ayşe Yılmaz", phone: null, birth_date: null })
  })

  it("rejects bad phone, future or malformed dates, and short names on their fields", async () => {
    const result = await updateProfile({ name: "A", phone: "12", birthDate: "2999-01-01" }, fakes())
    assert.deepEqual(Object.keys(result.fieldErrors ?? {}).sort(), ["birthDate", "name", "phone"])
    const bad = await updateProfile({ name: "Ayşe", phone: "", birthDate: "31/12/1990" }, fakes())
    assert.ok(bad.fieldErrors?.birthDate)
  })

  it("uses the ordinary update bucket and reports failed saves", async () => {
    const deps = fakes({ saveProfile: async () => false })
    const result = await updateProfile({ name: "Ayşe", phone: "0555 000 00 00", birthDate: "1990-05-01" }, deps)
    assert.equal(result.ok, false)
    assert.ok(deps.calls.includes("allow:account_update:user-1"))
  })
})

describe("campaign e-mail consent", () => {
  it("accepts only true/false and records the choice", async () => {
    const deps = fakes()
    assert.equal((await setMarketingConsent({ granted: "true" }, deps)).granted, true)
    assert.equal((await setMarketingConsent({ granted: "false" }, deps)).granted, false)
    assert.deepEqual(deps.calls.filter((c) => c.startsWith("marketing")), ["marketing:true", "marketing:false"])
    assert.equal((await setMarketingConsent({ granted: "yes" }, fakes())).ok, false)
  })

  it("is rate limited and reports a failed save so the switch can revert", async () => {
    assert.equal((await setMarketingConsent({ granted: "true" }, fakes(limited))).message, RATE_LIMIT_MESSAGE)
    assert.equal((await setMarketingConsent({ granted: "true" }, fakes({ setMarketingConsent: async () => false }))).ok, false)
  })
})

describe("formObject", () => {
  it("keeps string fields only", () => {
    const form = new FormData()
    form.set("a", "1")
    form.set("file", new Blob(["x"]))
    assert.deepEqual(formObject(form), { a: "1" })
  })
})
