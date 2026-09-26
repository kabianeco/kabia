import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  MESSAGES,
  changeEmail,
  changePassword,
  deleteAccount,
  exportData,
  signOutEverywhere,
  updateProfile,
  setMarketingConsent,
  type SessionUser,
} from "@/lib/account/handlers";
import { newPasswordField, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import {
  adminSetCustomerPasswordSchema,
  customerIdParamSchema,
} from "@/lib/admin/schemas";
import { can } from "@/lib/admin/roles";
import { describeAuditAction } from "@/lib/admin/audit";
import { adminPasswordResetEmail } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

// Feature 3: müşteri parola işlemleri — recovery bağlantısı (her yönetici) ve
// doğrudan şifre belirleme (yalnızca süper yönetici) + zorunlu değişim bayrağı.

const FLAGGED: SessionUser = {
  id: "user-1",
  email: "musteri@example.com",
  hasPassword: true,
  mustChangePassword: true,
};

function fakes() {
  const calls: string[] = [];
  return {
    calls,
    async getUser(): Promise<SessionUser | null> { calls.push("getUser"); return FLAGGED; },
    async allow() { calls.push("allow"); return true; },
    async verifyPassword() { calls.push("verify"); return true; },
    async updatePassword() { calls.push("updatePassword"); return "ok" as const; },
    async clearPasswordFlag() { calls.push("clearFlag"); return true; },
    async requestEmailChange() { calls.push("emailChange"); return "ok" as const; },
    async signOutGlobal() { calls.push("signOutGlobal"); return true; },
    async collect() { calls.push("collect"); return {}; },
    async hasStaffRole() { return false; },
    async removeAccountContent() { return true; },
    async deleteAuthUser() { return true; },
    async saveProfile() { calls.push("saveProfile"); return true; },
    async setMarketingConsent() { calls.push("marketing"); return true; },
  };
}

describe("must-change flag gates mutating account actions", () => {
  it("blocks profile, email, sign-out-everywhere, export, deletion and consent", async () => {
    const deps = fakes();
    for (const [name, run] of [
      ["updateProfile", () => updateProfile({ name: "Ad Soyad", phone: "", birthDate: "" }, deps)],
      ["changeEmail", () => changeEmail({ newEmail: "yeni@example.com", currentPassword: "x" }, deps)],
      ["signOutEverywhere", () => signOutEverywhere({ currentPassword: "x" }, deps)],
      ["exportData", () => exportData({ currentPassword: "x" }, deps)],
      ["deleteAccount", () => deleteAccount({ currentPassword: "x", confirm: "on" }, deps)],
      ["marketing", () => setMarketingConsent({ granted: "true" }, deps)],
    ] as const) {
      const result = await run();
      assert.equal(result.ok, false, `${name} must be blocked`);
      assert.equal(result.message, MESSAGES.mustChangePassword, `${name} message`);
    }
    // Hiçbir etki çalışmamalı: yalnızca getUser çağrılır.
    assert.deepEqual(deps.calls, ["getUser", "getUser", "getUser", "getUser", "getUser", "getUser"]);
  });

  it("changePassword still runs and clears the flag on success", async () => {
    const deps = fakes();
    const result = await changePassword(
      { currentPassword: "dogru-sifre", newPassword: "yeni-uzun-sifre" },
      deps,
    );
    assert.equal(result.ok, true);
    assert.ok(deps.calls.includes("updatePassword"), "password must be updated");
    assert.ok(deps.calls.includes("clearFlag"), "flag must be cleared after change");
  });

  it("unflagged users are unaffected", async () => {
    const deps = fakes();
    deps.getUser = async () => ({ id: "user-1", email: "musteri@example.com", hasPassword: true });
    const result = await updateProfile({ name: "Ad Soyad", phone: "", birthDate: "" }, deps);
    assert.equal(result.ok, true);
  });
});

describe("customer password policy (min 8, shared rule)", () => {
  it("minimum length is 8", () => {
    assert.equal(PASSWORD_MIN_LENGTH, 8);
    assert.equal(newPasswordField.safeParse("kisa7ch").success, false);
    assert.equal(newPasswordField.safeParse("uzun-sifre-1").success, true);
  });
});

describe("admin set-password validation", () => {
  const CID = "a69550e7-262b-4381-9945-78acf7334f1b";
  const base = { customer_id: CID, reason: "Müşteri telefonla istedi.", mode: "generate" };

  it("generate mode needs only a valid reason", () => {
    assert.equal(adminSetCustomerPasswordSchema.safeParse(base).success, true);
    assert.equal(
      adminSetCustomerPasswordSchema.safeParse({ ...base, reason: "x" }).success,
      false,
    );
  });

  it("manual mode enforces the shared min-8 rule plus confirmation", () => {
    const manual = { ...base, mode: "manual", password: "kisa7ch", confirm: "kisa7ch" };
    const short = adminSetCustomerPasswordSchema.safeParse(manual);
    assert.equal(short.success, false);
    const mismatch = adminSetCustomerPasswordSchema.safeParse({
      ...base, mode: "manual", password: "uzun-sifre-1", confirm: "baska-sifre-2",
    });
    assert.equal(mismatch.success, false);
    const good = adminSetCustomerPasswordSchema.safeParse({
      ...base, mode: "manual", password: "uzun-sifre-1", confirm: "uzun-sifre-1",
    });
    assert.equal(good.success, true);
  });

  it("customer id must be a uuid", () => {
    assert.equal(customerIdParamSchema.safeParse({ customer_id: "nope" }).success, false);
    assert.equal(customerIdParamSchema.safeParse({ customer_id: CID }).success, true);
  });
});

describe("permissions and audit vocabulary", () => {
  it("manageCustomers belongs to both admin roles (recovery link)", () => {
    assert.equal(can("admin", "manageCustomers"), true);
    assert.equal(can("super_admin", "manageCustomers"), true);
  });

  it("new audit actions have Turkish labels", () => {
    assert.ok(describeAuditAction("customer.recovery_sent").length > 3);
    assert.ok(describeAuditAction("customer.password_set").length > 3);
    assert.ok(describeAuditAction("order.admin_create").length > 3);
    assert.notEqual(describeAuditAction("customer.password_set"), "customer.password_set");
  });
});

describe("admin password-reset notification email", () => {
  it("uses the shared layout and cannot carry a password", () => {
    const mail = adminPasswordResetEmail({ name: "Mustafa <b>Test</b>" });
    assert.equal(mail.subject, "Hesap şifreniz güncellendi");
    assert.ok(mail.html.includes("Kabia"), "shared layout");
    assert.ok(mail.html.includes("Mustafa &lt;b&gt;Test&lt;/b&gt;"), "name escaped");
    assert.ok(mail.text.includes("/giris"), "login link present");
    // Yapısal güvence: şablon yalnızca ad alır; parola parametresi yok.
    const src = readFileSync("lib/email/password-admin-reset.ts", "utf8");
    const ifaceStart = src.indexOf("{", src.indexOf("interface AdminPasswordResetInput"));
    const iface = src.slice(ifaceStart, src.indexOf("export function adminPasswordResetEmail"));
    assert.ok(!/password/i.test(iface), "template input must not accept a password");
    assert.ok(!/password|parola/i.test(mail.text.replace(/şifreniz|şifre/gi, "")), "no password in body");
  });
});

describe("Resend sender fails closed without a key", () => {
  it("returns missing_key and performs no network", async () => {
    const had = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const result = await sendEmail({ to: "a@b.c", subject: "s", html: "<p>x</p>", text: "x" });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "missing_key");
    } finally {
      if (had !== undefined) process.env.RESEND_API_KEY = had;
    }
  });
});

describe("password flag migration guarantees", () => {
  const src = readFileSync(
    "supabase/migrations/20260927000400_customer_password_flag.sql",
    "utf8",
  );

  it("adds the flag default-false and guards direct writes", () => {
    assert.match(src, /must_change_password boolean not null default false/);
    assert.match(src, /guard_customer_password_flag/);
    assert.match(src, /kabia\.allow_password_flag_write/);
  });

  it("provides audited customer + admin RPCs", () => {
    assert.match(src, /customer_complete_password_change/);
    assert.match(src, /admin_set_customer_must_change/);
    assert.match(src, /if not public\.has_admin_role\(\)/);
  });
});

describe("admin password actions (source guarantees)", () => {
  const src = readFileSync(
    "app/admin/(protected)/customers/[customerId]/actions.ts",
    "utf8",
  );

  it("recovery link: customer-management permission + audit", () => {
    assert.ok(src.includes('adminContext("manageCustomers")'), "permission gate missing");
    assert.ok(src.includes("resetPasswordForEmail"), "standard recovery flow missing");
    assert.ok(src.includes("customer.recovery_sent"), "audit missing");
  });

  it("set password: super admin only, mandatory reason, global revoke", () => {
    assert.ok(src.includes("requireSuperAdmin"), "super-admin gate missing");
    assert.ok(src.includes("adminSetCustomerPasswordSchema"), "shared validation missing");
    const schemas = readFileSync("lib/admin/schemas.ts", "utf8");
    assert.match(schemas, /Gerekçe en az 3 karakter/);
    assert.ok(src.includes('scope: "global"'), "session revocation missing");
    assert.ok(src.includes("admin_set_customer_must_change"), "flag call missing");
    assert.ok(src.includes("customer.password_set"), "audit missing");
  });

  it("never logs the password", () => {
    const at = src.indexOf('action: "customer.password_set"');
    assert.ok(at >= 0, "audit call missing");
    // Denetim çağrısının yükü (eylem adından sonrası): parola değeri giremez.
    const payload = src.slice(at + 'action: "customer.password_set"'.length, at + 400);
    assert.ok(!/newPassword|password:/i.test(payload), "password value must not enter the audit payload");
    assert.ok(src.includes("Parola bellek dışında hiçbir yere yazılmaz"), "intent comment missing");
  });

  it("manual passwords follow the shared customer rule", () => {
    const schemas = readFileSync("lib/admin/schemas.ts", "utf8");
    assert.ok(schemas.includes("newPasswordField"), "shared policy missing");
    assert.ok(src.includes("adminSetCustomerPasswordSchema"), "action must use the shared schema");
  });

  it("UI exists with confirmation and super-admin gating", () => {
    assert.ok(existsSync("app/admin/(protected)/customers/[customerId]/password-actions.tsx"));
    const page = readFileSync("app/admin/(protected)/customers/[customerId]/page.tsx", "utf8");
    assert.ok(page.includes('session.role === "super_admin"'), " gating missing");
    assert.ok(page.includes("Parola işlemleri"), "panel missing");
  });
});
