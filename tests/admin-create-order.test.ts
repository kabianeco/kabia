import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  ADMIN_ORDER_PAYMENT_LABELS,
  adminCreateOrderSchema,
  customerNumberLookupSchema,
} from "@/lib/admin/schemas";
import { limiterErrorResult } from "@/lib/auth/rate-limit";

// Feature 2: yönetici müşteri adına sipariş oluşturur (/admin/orders/yeni + admin_create_order).

describe("adminCreateOrderSchema", () => {
  const base = {
    customer_id: "a69550e7-262b-4381-9945-78acf7334f1b",
    items: [{ variant_id: "213e6f8d-e4a5-4169-bc28-31fe12823734", quantity: 1 }],
    shipping_address: {
      recipientName: "Mustafa Said",
      phone: "05525540710",
      addressLine1: "Test Mah. 1/2",
      city: "Sakarya",
      district: "Geyve",
    },
    payment_method: "cod",
    consent_note: "Telefonda sözlü onay alındı.",
  };

  it("accepts cod and bank_transfer", () => {
    assert.equal(adminCreateOrderSchema.safeParse(base).success, true);
    assert.equal(
      adminCreateOrderSchema.safeParse({ ...base, payment_method: "bank_transfer" }).success,
      true,
    );
  });

  it("rejects card: no card entry on the admin path", () => {
    const r = adminCreateOrderSchema.safeParse({ ...base, payment_method: "card" });
    assert.equal(r.success, false);
  });

  it("carries no price field: prices always come from the database", () => {
    const src = readFileSync("lib/admin/schemas.ts", "utf8");
    const start = src.indexOf("adminCreateOrderSchema = z.object");
    const block = src.slice(start, src.indexOf("export type AdminCreateOrderInput"));
    assert.ok(!/price|tutar|fiyat/i.test(block), "schema must not accept a price");
    const withPrice = adminCreateOrderSchema.safeParse({
      ...base,
      items: [{ variant_id: base.items[0].variant_id, quantity: 1, price: 1 }],
    });
    assert.equal(withPrice.success, true, "unknown keys are stripped, never trusted");
    if (withPrice.success) {
      assert.ok(!("price" in (withPrice.data.items[0] as object)), "price must be stripped");
    }
  });

  it("requires an explicit consent statement, rejects empty items", () => {
    assert.equal(
      adminCreateOrderSchema.safeParse({ ...base, consent_note: "" }).success,
      false,
    );
    assert.equal(adminCreateOrderSchema.safeParse({ ...base, items: [] }).success, false);
    assert.equal(
      adminCreateOrderSchema.safeParse({
        ...base,
        items: [{ variant_id: base.items[0].variant_id, quantity: 0 }],
      }).success,
      false,
    );
  });

  it("labels both offline payment methods in Turkish", () => {
    assert.equal(ADMIN_ORDER_PAYMENT_LABELS.cod, "Kapıda ödeme");
    assert.equal(ADMIN_ORDER_PAYMENT_LABELS.bank_transfer, "Havale / EFT");
  });
});

describe("customerNumberLookupSchema", () => {
  it("accepts KE-###### and normalizes case", () => {
    const r = customerNumberLookupSchema.safeParse({ customer_number: "ke-123456" });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.customer_number, "KE-123456");
  });

  it("rejects malformed numbers", () => {
    assert.equal(customerNumberLookupSchema.safeParse({ customer_number: "123456" }).success, false);
    assert.equal(customerNumberLookupSchema.safeParse({ customer_number: "KE-12345" }).success, false);
  });
});

describe("admin_order_create rate limiting", () => {
  it("fails closed like the other privileged buckets", () => {
    assert.deepEqual(limiterErrorResult("admin_order_create"), { allowed: false, retryAfter: 60 });
  });

  it("the create action goes through the limiter", () => {
    const src = readFileSync("app/admin/(protected)/orders/yeni/actions.ts", "utf8");
    assert.ok(src.includes('checkRateLimit("admin_order_create"'), "limiter call missing");
  });
});

describe("admin_create_order migration guarantees", () => {
  const src = readFileSync(
    "supabase/migrations/20260927000300_admin_create_order.sql",
    "utf8",
  );

  it("re-checks the admin role inside the body", () => {
    assert.match(src, /if not public\.has_admin_role\(\)/);
  });

  it("reuses create_order mechanics: atomic stock, order number, snapshots", () => {
    assert.match(src, /stock_quantity = stock_quantity - v_qty/);
    assert.match(src, /stock_quantity >= v_qty/);
    assert.match(src, /'order\.commit'/);
    assert.match(src, /stock_committed[^;]*true/);
    assert.match(src, /'KB-' \|\| v_code/);
    assert.match(src, /order_items \(order_id, product_id, variant_id/);
    assert.match(src, /order_status_history/);
    assert.match(src, /kabia\.allow_stock_write/);
  });

  it("records the creating admin and audits", () => {
    assert.match(src, /admin_created_by/);
    assert.match(src, /admin_created_at/);
    assert.match(src, /log_admin_action\(\s*'order\.admin_create'/);
  });

  it("never fakes customer consent: flags false, statement explicit", () => {
    assert.match(src, /consented_sales[^;]*false/);
    assert.match(src, /consent_note/);
    assert.match(src, /Sözlü ya da kayıtlı onayın açık ifadesi gerekli/);
  });

  it("allows only offline payments, no card fields", () => {
    assert.match(src, /'cod' and p_payment_method is distinct from 'bank_transfer'/);
    assert.ok(!src.includes("p_card_last4"), "no card fields on the admin path");
  });
});

describe("admin order screen", () => {
  it("route and actions exist", () => {
    assert.ok(existsSync("app/admin/(protected)/orders/yeni/page.tsx"));
    assert.ok(existsSync("app/admin/(protected)/orders/yeni/actions.ts"));
    assert.ok(existsSync("app/admin/(protected)/orders/yeni/order-form.tsx"));
  });

  it("orders list links to the new screen and filters bank_transfer", () => {
    const src = readFileSync("app/admin/(protected)/orders/page.tsx", "utf8");
    assert.ok(src.includes("/admin/orders/yeni"), "list must link the screen");
    assert.ok(src.includes("bank_transfer"), "list must handle the new method");
  });

  it("order detail shows admin provenance and consent", () => {
    const src = readFileSync("app/admin/(protected)/orders/[orderId]/page.tsx", "utf8");
    assert.ok(src.includes("admin_created_by"), "detail must read provenance");
    assert.ok(src.includes("consent_note"), "detail must show the consent statement");
  });
});
