/**
 * Authorization, validation and business-rule unit tests for the admin
 * dashboard.
 *
 * These exercise the pure decision logic that the UI and the server actions
 * both rely on. They are deliberately not a substitute for the database's own
 * guarantees — RLS, the order-status trigger and the last-super-admin trigger
 * are the real boundaries, and are verified against the live database. What is
 * tested here is that the application never *offers* something the database
 * would reject, and never widens a check by accident.
 *
 * Run under `--conditions=react-server` so `server-only` modules resolve to
 * their no-op build instead of throwing.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { ADMIN_ROLES, can, isAdminRole, PERMISSIONS, ROLE_LABELS } from "../lib/admin/roles.ts"
import { navForRole } from "../lib/admin/nav.ts"
import { resolveAdminIdentifier, GENERIC_LOGIN_ERROR } from "../lib/admin/login.ts"
import { ORDER_TRANSITIONS, stockLevel } from "../lib/admin/orders.ts"
import { sanitizeSearch } from "../lib/admin/queries/products.ts"
import { pickEnum, pickPage, buildQuery } from "../lib/admin/url.ts"
import {
  orderStatusSchema,
  passwordChangeSchema,
  productSchema,
  slugSchema,
  stockAdjustmentSchema,
  settingValueSchemas,
  mediaUploadSchema,
  variantSchema,
} from "../lib/admin/schemas.ts"
import { formatCurrency, storeDayRange, toNumber } from "../lib/admin/format.ts"

describe("role model", () => {
  it("treats only admin and super_admin as administrative", () => {
    assert.equal(isAdminRole("admin"), true)
    assert.equal(isAdminRole("super_admin"), true)
    assert.equal(isAdminRole("customer"), false)
    assert.equal(isAdminRole(null), false)
    assert.equal(isAdminRole(undefined), false)
    assert.equal(isAdminRole("Admin"), false, "role matching must not be case-insensitive")
    assert.equal(isAdminRole("super admin"), false)
  })

  it("denies every permission to a missing role", () => {
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      assert.equal(can(null, permission), false, `null gained ${permission}`)
      assert.equal(can(undefined, permission), false, `undefined gained ${permission}`)
    }
  })

  it("withholds administrator management and sensitive settings from a plain admin", () => {
    assert.equal(can("admin", "manageAdministrators"), false)
    assert.equal(can("admin", "manageSensitiveSettings"), false)
    assert.equal(can("admin", "viewAllAuditLogs"), false)
  })

  it("grants a plain admin the day-to-day operational permissions", () => {
    for (const permission of [
      "manageCatalogue",
      "manageCategories",
      "manageInventory",
      "manageOrders",
      "viewCustomers",
      "manageMedia",
      "manageContent",
      "manageSettings",
    ] as const) {
      assert.equal(can("admin", permission), true, `admin lost ${permission}`)
    }
  })

  it("grants a super_admin everything a plain admin has, and more", () => {
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      if (can("admin", permission)) {
        assert.equal(can("super_admin", permission), true, `super_admin lost ${permission}`)
      }
    }
    assert.equal(can("super_admin", "manageAdministrators"), true)
    assert.equal(can("super_admin", "manageSensitiveSettings"), true)
    assert.equal(can("super_admin", "viewAllAuditLogs"), true)
  })

  it("labels every role for the interface", () => {
    for (const role of ADMIN_ROLES) {
      assert.ok(ROLE_LABELS[role], `${role} has no label`)
    }
  })
})

describe("navigation visibility", () => {
  it("hides the administrators screen from a plain admin", () => {
    const hrefs = navForRole("admin").map((item) => item.href)
    assert.ok(!hrefs.includes("/admin/administrators"))
    assert.ok(hrefs.includes("/admin/products"))
  })

  it("shows the administrators screen to a super_admin", () => {
    const hrefs = navForRole("super_admin").map((item) => item.href)
    assert.ok(hrefs.includes("/admin/administrators"))
  })
})

describe("admin username alias", () => {
  it("maps the configured alias to the bootstrap email, server-side", () => {
    assert.equal(resolveAdminIdentifier("admin"), "admin@kabia.local")
    assert.equal(resolveAdminIdentifier("  ADMIN  "), "admin@kabia.local")
  })

  it("passes an email through unchanged, lowercased", () => {
    assert.equal(resolveAdminIdentifier("Someone@Example.com"), "someone@example.com")
  })

  it("refuses any other username rather than guessing an address", () => {
    assert.equal(resolveAdminIdentifier("root"), null)
    assert.equal(resolveAdminIdentifier("administrator"), null)
    assert.equal(resolveAdminIdentifier(""), null)
    assert.equal(resolveAdminIdentifier("   "), null)
    assert.equal(resolveAdminIdentifier("not-an-email@"), null)
  })

  it("uses one message for every failure so accounts cannot be enumerated", () => {
    assert.match(GENERIC_LOGIN_ERROR, /Kullanıcı adı veya şifre hatalı/)
  })
})

describe("order status transitions", () => {
  it("allows every cross-status move for administrators", () => {
    const allStatuses: (keyof typeof ORDER_TRANSITIONS)[] = [
      "hazirlaniyor",
      "kargoda",
      "teslim_edildi",
      "iptal_edildi",
    ]
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (from !== to) {
          assert.ok(
            ORDER_TRANSITIONS[from].includes(to),
            `${from} → ${to} should be allowed`,
          )
        }
      }
    }
  })

  it("rejects an unknown status at the schema boundary", () => {
    const valid = orderStatusSchema.safeParse({
      order_id: "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      status: "kargoda",
    })
    assert.equal(valid.success, true)

    const invalid = orderStatusSchema.safeParse({
      order_id: "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      status: "refunded",
    })
    assert.equal(invalid.success, false)
  })
})

describe("stock levels", () => {
  it("classifies against the product's own threshold", () => {
    assert.equal(stockLevel(0, 5), "out")
    assert.equal(stockLevel(3, 5), "low")
    assert.equal(stockLevel(5, 5), "low", "at the threshold is still low")
    assert.equal(stockLevel(6, 5), "healthy")
  })

  it("treats a zero threshold as out-only", () => {
    assert.equal(stockLevel(0, 0), "out")
    assert.equal(stockLevel(1, 0), "healthy")
  })
})

describe("stock adjustment validation", () => {
  const variant = "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

  it("converts a direction and quantity into a signed change", () => {
    const increase = stockAdjustmentSchema.parse({
      variant_id: variant,
      direction: "increase",
      quantity: "10",
      reason: "Yeni sevkiyat",
    })
    assert.equal(increase.change, 10)

    const decrease = stockAdjustmentSchema.parse({
      variant_id: variant,
      direction: "decrease",
      quantity: "4",
      reason: "Hasarlı ürün",
    })
    assert.equal(decrease.change, -4)
  })

  it("requires a reason", () => {
    const result = stockAdjustmentSchema.safeParse({
      variant_id: variant,
      direction: "increase",
      quantity: "1",
      reason: "",
    })
    assert.equal(result.success, false)
  })

  it("rejects a zero or negative quantity", () => {
    for (const quantity of ["0", "-5"]) {
      const result = stockAdjustmentSchema.safeParse({
        variant_id: variant,
        direction: "increase",
        quantity,
        reason: "Sayım düzeltmesi",
      })
      assert.equal(result.success, false, `quantity ${quantity} was accepted`)
    }
  })
})

describe("product validation", () => {
  const base = {
    name: "Çiğ Badem",
    slug: "cig-badem",
    category_id: "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    short_description: "Kısa",
    description: "Uzun açıklama",
    base_price: "100",
    original_price: "",
    main_image_url: "https://example.com/a.jpg",
    is_active: true,
    is_featured: false,
    low_stock_threshold: "5",
    display_order: "0",
    // Already through variantSchema — see the two-stage test below.
    variants: [{ label: "500 g", price: 100, stock_quantity: 10, sku: null }],
  }

  it("accepts a well-formed product", () => {
    const result = productSchema.safeParse(base)
    assert.equal(result.success, true, JSON.stringify(result.error?.issues))
  })

  it("requires the base price to match one of the variants", () => {
    const result = productSchema.safeParse({ ...base, base_price: "999" })
    assert.equal(result.success, false)
    assert.ok(result.error!.issues.some((issue) => issue.path.includes("base_price")))
  })

  it("rejects a compare-at price that is not above the base price", () => {
    const result = productSchema.safeParse({ ...base, original_price: "80" })
    assert.equal(result.success, false)
    assert.ok(result.error!.issues.some((issue) => issue.path.includes("original_price")))
  })

  it("rejects duplicate variant labels", () => {
    const result = productSchema.safeParse({
      ...base,
      variants: [
        { label: "500 g", price: 100, stock_quantity: 1, sku: null },
        { label: "500 G", price: 100, stock_quantity: 1, sku: null },
      ],
    })
    assert.equal(result.success, false)
  })

  it("rejects duplicate SKUs", () => {
    const result = productSchema.safeParse({
      ...base,
      base_price: "100",
      variants: [
        { label: "500 g", price: 100, stock_quantity: 1, sku: "KB-1" },
        { label: "1 kg", price: 180, stock_quantity: 1, sku: "KB-1" },
      ],
    })
    assert.equal(result.success, false)
  })

  it("requires at least one variant", () => {
    const result = productSchema.safeParse({ ...base, variants: [] })
    assert.equal(result.success, false)
  })

  /**
   * Regression: saving any product with a variant used to fail outright.
   *
   * The save action parses the editor's variants JSON with `variantSchema`
   * first, which transforms `price` from the form's string into a number, and
   * then validated the whole product with `productSchema`. When that schema
   * re-ran `variantSchema` over the already-transformed array, `priceField`'s
   * leading `z.string()` received a number and every save died with "expected
   * string, received number".
   *
   * The tests above missed it because they fed the *form* shape straight into
   * `productSchema` — a combination the application never produces. This one
   * runs both stages in the order the action runs them.
   */
  it("accepts variants that have already been through variantSchema", () => {
    const fromEditor = { id: null, label: "500 g", price: "100", stock_quantity: 10, sku: "" }

    const stageOne = variantSchema.safeParse(fromEditor)
    assert.equal(stageOne.success, true, JSON.stringify(stageOne.error?.issues))
    assert.equal(typeof stageOne.data!.price, "number", "stage one must yield a number")

    const stageTwo = productSchema.safeParse({ ...base, variants: [stageOne.data] })
    assert.equal(
      stageTwo.success,
      true,
      `second stage rejected first-stage output: ${JSON.stringify(stageTwo.error?.issues)}`,
    )
  })

  it("rejects a negative price", () => {
    const result = productSchema.safeParse({
      ...base,
      base_price: "-1",
      variants: [{ label: "500 g", price: "-1", stock_quantity: 1, sku: "" }],
    })
    assert.equal(result.success, false)
  })

  it("accepts a Turkish decimal comma", () => {
    // The comma is normalised by priceField, which runs in variantSchema for a
    // variant's price and in productSchema for base_price. Both are exercised:
    // the variant goes through its own stage first, as the save action does.
    const variant = variantSchema.safeParse({
      label: "500 g",
      price: "129,90",
      stock_quantity: 1,
      sku: "",
    })
    assert.equal(variant.success, true, JSON.stringify(variant.error?.issues))
    assert.equal(variant.data!.price, 129.9, "comma must be normalised in a variant price")

    const result = productSchema.safeParse({
      ...base,
      base_price: "129,90",
      variants: [variant.data],
    })
    assert.equal(result.success, true, JSON.stringify(result.error?.issues))
    assert.equal(result.data!.base_price, 129.9)
  })
})

describe("slug rules", () => {
  it("accepts lowercase kebab-case", () => {
    assert.equal(slugSchema.safeParse("cig-badem-500g").success, true)
  })

  it("rejects uppercase, spaces, Turkish characters and path traversal", () => {
    for (const slug of ["Cig-Badem", "cig badem", "çiğ-badem", "../etc", "cig--badem-", "-cig"]) {
      assert.equal(slugSchema.safeParse(slug).success, false, `${slug} was accepted`)
    }
  })
})

describe("password policy for administrators", () => {
  it("rejects anything under 12 characters, including the bootstrap password", () => {
    for (const password of ["admin", "short", "Passw0rd"]) {
      const result = passwordChangeSchema.safeParse({ password, confirm: password })
      assert.equal(result.success, false, `${password} was accepted`)
    }
  })

  it("requires mixed case and a digit", () => {
    assert.equal(
      passwordChangeSchema.safeParse({
        password: "alllowercase123",
        confirm: "alllowercase123",
      }).success,
      false,
    )
    assert.equal(
      passwordChangeSchema.safeParse({
        password: "NoDigitsInHere!",
        confirm: "NoDigitsInHere!",
      }).success,
      false,
    )
  })

  it("requires the confirmation to match", () => {
    const result = passwordChangeSchema.safeParse({
      password: "GoodPassword123",
      confirm: "GoodPassword124",
    })
    assert.equal(result.success, false)
  })

  it("accepts a compliant password", () => {
    assert.equal(
      passwordChangeSchema.safeParse({
        password: "GoodPassword123",
        confirm: "GoodPassword123",
      }).success,
      true,
    )
  })
})

describe("settings value typing", () => {
  it("parses a boolean setting only from true/false", () => {
    assert.equal(settingValueSchemas.boolean.parse("true"), true)
    assert.equal(settingValueSchemas.boolean.parse("false"), false)
    assert.equal(settingValueSchemas.boolean.safeParse("banana").success, false)
    assert.equal(settingValueSchemas.boolean.safeParse("1").success, false)
  })

  it("parses a number setting and rejects non-numeric text", () => {
    assert.equal(settingValueSchemas.number.parse("500"), 500)
    assert.equal(settingValueSchemas.number.parse("29,90"), 29.9)
    assert.equal(settingValueSchemas.number.safeParse("bedava").success, false)
    assert.equal(settingValueSchemas.number.safeParse("-1").success, false)
  })
})

describe("media upload validation", () => {
  it("rejects a non-image MIME type", () => {
    const result = mediaUploadSchema.safeParse({
      fileName: "payload.svg",
      mimeType: "image/svg+xml",
      size: 100,
    })
    assert.equal(result.success, false, "SVG must be rejected — it can carry script")
  })

  it("rejects a file over the 10 MB limit", () => {
    const result = mediaUploadSchema.safeParse({
      fileName: "big.jpg",
      mimeType: "image/jpeg",
      size: 11 * 1024 * 1024,
    })
    assert.equal(result.success, false)
  })

  it("accepts a normal photo", () => {
    const result = mediaUploadSchema.safeParse({
      fileName: "badem.jpg",
      mimeType: "image/jpeg",
      size: 400_000,
    })
    assert.equal(result.success, true)
  })
})

describe("search input is bounded and injection-safe", () => {
  it("strips the PostgREST filter metacharacters", () => {
    const cleaned = sanitizeSearch('badem,is_active.eq.false)(or(')
    assert.ok(!cleaned.includes(","), "comma survived")
    assert.ok(!cleaned.includes("("), "paren survived")
    assert.ok(!cleaned.includes(")"), "paren survived")
  })

  it("keeps Turkish letters, digits and ordinary punctuation", () => {
    assert.equal(sanitizeSearch("Çiğ Badem 500g"), "Çiğ Badem 500g")
    assert.equal(sanitizeSearch("KB-100_A.1"), "KB-100_A.1")
  })

  it("caps the length so a query cannot be made unbounded", () => {
    assert.equal(sanitizeSearch("a".repeat(500)).length, 60)
  })

  it("returns empty for nothing", () => {
    assert.equal(sanitizeSearch(undefined), "")
    assert.equal(sanitizeSearch(null), "")
    assert.equal(sanitizeSearch("   "), "")
  })
})

describe("list query parameters are never trusted", () => {
  it("falls back to a safe default for an unknown sort field", () => {
    const allowed = ["created_at", "total"] as const
    assert.equal(pickEnum({ sirala: "; drop table" }, "sirala", allowed, "created_at"), "created_at")
    assert.equal(pickEnum({ sirala: "total" }, "sirala", allowed, "created_at"), "total")
  })

  it("clamps the page number", () => {
    assert.equal(pickPage({ sayfa: "0" }), 1)
    assert.equal(pickPage({ sayfa: "-5" }), 1)
    assert.equal(pickPage({ sayfa: "abc" }), 1)
    assert.equal(pickPage({ sayfa: "99999999" }), 10_000)
    assert.equal(pickPage({ sayfa: "3" }), 3)
  })

  it("drops the page offset when a filter changes", () => {
    const query = buildQuery({ sayfa: "4", durum: "aktif" }, { durum: "arsiv", sayfa: null })
    assert.ok(!query.includes("sayfa"))
    assert.ok(query.includes("durum=arsiv"))
  })
})

describe("money and dates", () => {
  it("reads PostgREST numerics whether they arrive as string or number", () => {
    assert.equal(toNumber("129.90"), 129.9)
    assert.equal(toNumber(129.9), 129.9)
    assert.equal(toNumber(null), 0)
    assert.equal(toNumber(undefined), 0)
    assert.equal(toNumber("not a number"), 0)
  })

  it("formats lira in the Turkish locale", () => {
    const formatted = formatCurrency(1234.5)
    assert.ok(formatted.includes("₺"), `no lira sign in ${formatted}`)
    assert.ok(formatted.includes("1.234"), `no Turkish thousands separator in ${formatted}`)
  })

  it("shows an honest zero rather than a blank", () => {
    assert.ok(formatCurrency(0).includes("0"))
  })

  it("builds a whole-day range in the store's timezone", () => {
    const { from, to } = storeDayRange(30)
    const days = (to.getTime() - from.getTime()) / 86_400_000
    assert.equal(days, 30)
    // Türkiye is UTC+3, so a local midnight is 21:00 UTC the day before.
    assert.equal(from.getUTCHours(), 21)
    assert.equal(to.getUTCHours(), 21)
  })
})
