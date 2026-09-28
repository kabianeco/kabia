import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  nextGuestCartAfterAdd,
  nextGuestCartAfterQuantity,
  readGuestCart,
  writeGuestCart,
  GUEST_CART_STORAGE_KEY,
} from "@/lib/cart-storage";

// Bug 1: toast "Sepete git" window.location.href ile tam yenileme yapar.
// addItem yalnızca setItems + useEffect'e bırakırsa, hızlı tıklamada effect
// çalışmadan sayfa yenilenir ve boş sepet okunur. Navbar Link aynı state'i
// koruduğu için doğru görünürdü. Çözüm: misafir yazımı aynı tick'te senkron.

describe("cart-storage pure helpers", () => {
  it("adds and accumulates quantities", () => {
    const item = {
      id: "a__1kg", slug: "a", name: "A", variant: "1kg",
      price: 100, image: "", variantId: "v1", productId: "p1",
    };
    let cart = nextGuestCartAfterAdd([], { ...item, quantity: 1 });
    assert.equal(cart.length, 1);
    assert.equal(cart[0].quantity, 1);
    cart = nextGuestCartAfterAdd(cart, { ...item, quantity: 2 });
    assert.equal(cart[0].quantity, 3);
  });

  it("clamps quantities and drops zero lines", () => {
    const item = {
      id: "a__1kg", slug: "a", name: "A", variant: "1kg",
      price: 100, image: "", variantId: "v1", productId: "p1", quantity: 1,
    };
    const cart = [item];
    assert.equal(nextGuestCartAfterQuantity(cart, "a__1kg", 0).length, 0);
    assert.equal(nextGuestCartAfterQuantity(cart, "a__1kg", 500)[0].quantity, 99);
  });

  it("reads sanitized guest cart from raw storage", () => {
    assert.deepEqual(readGuestCart(null), []);
    assert.deepEqual(readGuestCart("bozuk{"), []);
    const raw = JSON.stringify([{ id: "x", quantity: 500 }]);
    assert.equal(readGuestCart(raw)[0].quantity, 99);
  });

  it("writes synchronously to localStorage", () => {
    const store = new Map();
    // @ts-expect-error test çifti
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, String(v)); },
    };
    writeGuestCart([{ id: "a", slug: "a", name: "A", variant: "1kg", price: 1, quantity: 2, image: "", variantId: "v1", productId: "p1" }]);
    const raw = store.get(GUEST_CART_STORAGE_KEY);
    assert.ok(raw && raw.includes('"id":"a"'), "synchronous write missing");
    // @ts-expect-error temizlik
    delete globalThis.localStorage;
  });
});

describe("cart-context writes synchronously (Bug 1 regression)", () => {
  const src = readFileSync("lib/cart-context.tsx", "utf8");

  it("addItem persists in the same tick, not only in an effect", () => {
    const addStart = src.indexOf("const addItem = useCallback");
    const addEnd = src.indexOf("const updateQuantity = useCallback");
    assert.ok(addStart >= 0 && addEnd > addStart, "addItem block bulunamadı");
    const block = src.slice(addStart, addEnd);
    assert.ok(
      block.includes("setItemsSync") && block.includes("nextGuestCartAfterAdd"),
      "addItem senkron yazım yapmıyor (setItemsSync + nextGuestCartAfterAdd beklenir)",
    );
    assert.ok(
      !block.includes("setItems((prev)"),
      "addItem hâlâ yalnızca effect'e bırakan setItems(prev) kullanıyor",
    );
  });

  it("update/remove/clear also go through the synchronous path", () => {
    assert.ok(src.includes("nextGuestCartAfterQuantity"), "updateQuantity senkron değil");
    assert.ok(src.includes("const setItemsSync = useCallback"), "setItemsSync yok");
    assert.ok(src.includes("writeGuestCart(resolved)"), "senkron localStorage yazımı yok");
  });

  it("storage key is shared between context and helper", () => {
    assert.ok(src.includes("GUEST_CART_STORAGE_KEY"), "anahtar tek kaynaktan gelmiyor");
  });
});

describe("signed-in cart survives navigation and refresh (Bug 2)", () => {
  const ctx = readFileSync("lib/cart-context.tsx", "utf8");
  const addStart = ctx.indexOf("const addItem = useCallback");
  const addEnd = ctx.indexOf("const updateQuantity = useCallback");
  const block = ctx.slice(addStart, addEnd);

  it("the cart read disambiguates the product_variants embed (PGRST201)", () => {
    // cart_items has two FKs to product_variants (single-column + composite
    // coherence guard). An unhinted embed returns 300/PGRST201 with data null,
    // so the cart reads empty after every reload despite rows existing.
    assert.ok(
      ctx.includes("product_variants!cart_items_variant_id_fkey(label, price)"),
      "CART_SELECT must hint the single-column FK",
    );
    assert.ok(
      !ctx.includes('product_variants(label, price)'),
      "unhinted embed still present — reads will 300",
    );
  });

  it("addItem is awaitable: the DB write settles before callers navigate", () => {
    assert.match(block, /async \(item\)/, "addItem must be async so navigation can wait for it");
    assert.ok(block.includes('await supabase\n') || block.includes("await supabase"), "DB write must be awaited, not fire-and-forget");
    assert.ok(!block.includes(";(async () => {"), "fire-and-forget IIFE still present");
  });

  it("a rejected write resolves false and never plants a phantom item", () => {
    assert.ok(block.includes("if (error) return false"), "insert/update rejection must resolve false");
    assert.ok(block.includes("} catch {") && block.includes("return false"), "transport failure must resolve false");
    // The signed-in path reflects state only after the DB confirms (the guest
    // early-return above is storage-synchronous and has no DB to wait for).
    const confirmedAt = block.indexOf("only now reflect it in memory");
    const confirmedWrite = block.indexOf("setItemsSync((prev) => nextGuestCartAfterAdd", confirmedAt);
    assert.ok(confirmedAt !== -1 && confirmedWrite > confirmedAt, "in-memory update must come after the DB confirmation");
    assert.ok(block.lastIndexOf("await supabase.from") < confirmedAt, "confirmation comment must follow the awaited writes");
  });

  it("concurrent duplicate inserts merge instead of dropping the add", () => {
    assert.ok(block.includes("maybeSingle"), "409 fallback must re-read the stored row");
    assert.ok(block.includes("base + qty"), "fallback must sum onto the stored quantity");
  });

  it('no "Sepete git" action uses a full page reload', () => {
    for (const file of [
      "components/shop/product-purchase.tsx",
      "components/shop/product-detail-islands.tsx",
      "components/home/best-seller-add.tsx",
      "app/hesabim/siparislerim/[orderId]/detail-client.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      assert.ok(!src.includes("window.location.href"), `${file} still full-reloads to the cart`);
      assert.ok(src.includes("router.push(routes.cart)"), `${file} must navigate client-side like the navbar`);
    }
  });

  it("every add site awaits the write and shows a rejection", () => {
    for (const file of [
      "components/shop/product-purchase.tsx",
      "components/shop/product-detail-islands.tsx",
      "components/home/best-seller-add.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      assert.ok(src.includes("await addItem("), `${file} must await the confirmed write`);
      assert.ok(src.includes('toast.error("Sepete eklenemedi.'), `${file} must surface a rejected write`);
    }
    const reorder = readFileSync("app/hesabim/siparislerim/[orderId]/detail-client.tsx", "utf8");
    assert.ok(reorder.includes("await addItem(item)"), "reorder must await each write");
    assert.ok(reorder.includes("Bazı ürünler sepete eklenemedi"), "reorder must report partial failure");
  });

  it("the product ledger has no add-to-cart to fix", () => {
    const ledger = readFileSync("components/shop/product-entry.tsx", "utf8");
    assert.ok(!ledger.includes("addItem"), "ledger gained an add path — cover it like the others");
  });
});
