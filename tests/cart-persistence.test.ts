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
