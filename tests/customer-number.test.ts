import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isValidCustomerNumber,
  normalizeCustomerNumberSearch,
} from "@/lib/customer-number";

// Feature 1: KE-###### müşteri numaraları — rastgele, unique, immutable.

describe("isValidCustomerNumber", () => {
  it("accepts exactly KE-######", () => {
    assert.equal(isValidCustomerNumber("KE-000001"), true);
    assert.equal(isValidCustomerNumber("KE-712243"), true);
    assert.equal(isValidCustomerNumber("KE-999999"), true);
  });

  it("rejects sequential-looking or malformed values", () => {
    assert.equal(isValidCustomerNumber("KE-12345"), false);
    assert.equal(isValidCustomerNumber("KE-1234567"), false);
    assert.equal(isValidCustomerNumber("ke-123456"), false);
    assert.equal(isValidCustomerNumber("KB-123456"), false);
    assert.equal(isValidCustomerNumber("KE-ABCDEF"), false);
    assert.equal(isValidCustomerNumber(""), false);
    assert.equal(isValidCustomerNumber(null), false);
    assert.equal(isValidCustomerNumber(undefined), false);
    assert.equal(isValidCustomerNumber(123456), false);
  });
});

describe("normalizeCustomerNumberSearch", () => {
  it("normalizes a full number for the admin search", () => {
    assert.equal(normalizeCustomerNumberSearch("ke-712243"), "KE-712243");
    assert.equal(normalizeCustomerNumberSearch("  KE-88  "), "KE-88");
  });

  it("returns null for non-number input", () => {
    assert.equal(normalizeCustomerNumberSearch("Ahmet"), null);
    assert.equal(normalizeCustomerNumberSearch(""), null);
    assert.equal(normalizeCustomerNumberSearch(null), null);
  });
});

describe("customer number migration guarantees", () => {
  const src = readFileSync(
    "supabase/migrations/20260927000200_customer_numbers.sql",
    "utf8",
  );

  it("generates random (non-sequential) numbers with collision retry", () => {
    assert.match(src, /random\(\) \* 1000000/);
    assert.match(src, /if not exists \(select 1 from public\.profiles where customer_number = v_candidate\)/);
  });

  it("pins format, uniqueness and immutability", () => {
    assert.match(src, /\^KE-\[0-9\]\{6\}\$/);
    assert.match(src, /unique \(customer_number\)/);
    assert.match(src, /set not null/);
    assert.match(src, /guard_customer_number_immutable/);
    assert.match(src, /Müşteri numarası değiştirilemez/);
  });

  it("assigns at signup in handle_new_user and backfills", () => {
    assert.match(src, /public\.generate_customer_number\(\)/);
    assert.match(src, /where customer_number is null/);
  });

  it("exposes the number on the admin read model", () => {
    assert.match(src, /pr\.customer_number/);
    assert.match(src, /security_invoker = true/);
  });
});

describe("customer number surfaces", () => {
  it("account page shows the number", () => {
    const src = readFileSync("app/hesabim/bilgilerim/page.tsx", "utf8");
    assert.ok(src.includes("Müşteri numarası"), "bilgilerim must show the number");
    assert.ok(src.includes("customerNumber"), "must read from auth user");
  });

  it("admin list searches and shows the number", () => {
    const src = readFileSync("app/admin/(protected)/customers/page.tsx", "utf8");
    assert.ok(src.includes("customer_number.ilike"), "list must search by number");
    assert.ok(src.includes("Müşteri no"), "list must display the number");
  });

  it("admin detail shows the number", () => {
    const src = readFileSync(
      "app/admin/(protected)/customers/[customerId]/page.tsx",
      "utf8",
    );
    assert.ok(src.includes("customer_number"), "detail must select the number");
    assert.ok(src.includes("Müşteri no"), "detail must display the number");
  });

  it("auth user carries the number from profiles", () => {
    const src = readFileSync("lib/auth-context.tsx", "utf8");
    assert.ok(src.includes("customerNumber"), "AuthUser must carry customerNumber");
    assert.ok(src.includes("customer_number"), "ProfileRow must include the column");
  });
});
