# Stok durumu: hızlı işaretleme, mağaza ibaresi, görünüm kontrolü — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give administrators a one-click way to mark a variant out of stock, make "Stokta yok" unambiguous on the storefront, and let the appearance ("Görünüm") panel control how the out-of-stock badge looks.

**Architecture:** Three independent slices built on existing systems — no new tables, no new RPCs. (1) The inventory adjust-stock dialog gets a button that prefills the existing audited stock-adjustment form. (2) The shared `ProductEntry`/`ProductDetail` components get the "Stokta yok" wording. (3) The theme engine (`ThemeOverrides` → Zod schema → CSS-variable resolver → Fine-Tune Controls UI) gets a new `stockBadge` override group, and the storefront badge markup switches from hardcoded Tailwind classes to reading those CSS variables — exactly the pattern every other appearance control (radius, shadow, density) already uses.

**Tech Stack:** Next.js App Router, React (Server + Client Components), TypeScript, Zod, Tailwind v4 (CSS custom properties via `@utility`), Supabase, `node:test` for unit tests.

## Global Constraints

- Rozet metni sabit: **"Stokta yok"**. Serbest metin alanı yok.
- Renk serbest seçici değil — yalnızca `clay | ink | brand | olive | shell` (mevcut onaylı renk paleti).
- Kenar boşluğu (`inset`) yalnızca `[0, 2, 4, 8, 12, 16]` px allowlist'inden.
- Köşe yuvarlaklığı (`radius`) yalnızca mevcut `RADIUS_VALUES` allowlist'inden: `[0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 999]`.
- Ürün kartının altındaki sabit "Stokta yok" metin satırı, rozet görünürlük kontrolünden **etkilenmez** — her zaman görünür.
- Stok hareketi denetim akışı (gerekçeli, `admin_adjust_stock` RPC, negatife düşmeme) değişmeden aynen kullanılır — yeni bir DB fonksiyonu veya migration yok.
- Varsayılan `stockBadge` değerleri: `visible: true`, `tone: "clay"`, `fill: "solid"`, `position: "top-left"`, `inset: 8`, `radius: 0`.

---

### Task 1: Admin — "Stokta yok olarak işaretle" hızlı işlemi

**Files:**
- Modify: `app/admin/(protected)/inventory/adjust-stock.tsx`

**Interfaces:**
- Consumes: nothing new — uses the component's own existing `useState` setters (`setDirection`, `setQuantity`, `setReason`) and `currentStock` prop.
- Produces: nothing consumed elsewhere; this is a self-contained UI addition to an existing form.

- [ ] **Step 1: Add "Stokta yok" to the reason list**

In `app/admin/(protected)/inventory/adjust-stock.tsx`, find:

```tsx
const REASONS = [
  "Sayım düzeltmesi",
  "Yeni sevkiyat",
  "Hasarlı ürün",
  "İade girişi",
  "Numune / tadım",
  "Manuel satış",
  "Diğer",
] as const
```

Replace with:

```tsx
const REASONS = [
  "Sayım düzeltmesi",
  "Stokta yok",
  "Yeni sevkiyat",
  "Hasarlı ürün",
  "İade girişi",
  "Numune / tadım",
  "Manuel satış",
  "Diğer",
] as const
```

- [ ] **Step 2: Add the quick-action button**

In the same file, find:

```tsx
            <p className="mt-1 text-sm text-ink/60">
              {productName} · {variantLabel}
            </p>

            <div className="mt-5 space-y-4">
              <fieldset>
                <legend className="label mb-2 text-olive">Yön</legend>
```

Replace with:

```tsx
            <p className="mt-1 text-sm text-ink/60">
              {productName} · {variantLabel}
            </p>

            <div className="mt-5 space-y-4">
              <AdminButton
                variant="danger"
                className="w-full justify-center"
                disabled={currentStock <= 0}
                onClick={() => {
                  setDirection("decrease")
                  setQuantity(String(currentStock))
                  setReason("Stokta yok")
                }}
              >
                Stokta yok olarak işaretle
              </AdminButton>

              <fieldset>
                <legend className="label mb-2 text-olive">Yön</legend>
```

This reuses the existing `danger` button variant (`border border-clay/40 text-clay hover:bg-clay hover:text-on-brand`, defined in `components/admin/ui/form.tsx`) — no new styles needed. Clicking it sets `direction` to `"decrease"` and `quantity` to the variant's current stock, which the dialog's own `projected = currentStock - delta` math already zeroes out; the operator still presses "Güncelle" to submit through the audited `admin_adjust_stock` RPC. The button is disabled when there is nothing to zero out.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server on a port other than 3000 (the user runs `npm start` there separately): `npm run dev -- -p 3100`.

In a browser, sign in as an admin and go to `http://localhost:3100/admin/inventory`:
1. Pick a row with stock > 0, click "Stok güncelle". Confirm the dialog shows the new "Stokta yok olarak işaretle" button above "Yön".
2. Click it. Confirm: Yön switches to "Stok çıkar" (pressed state), Miktar becomes the row's current stock, Gerekçe becomes "Stokta yok", and "Sonuç" shows 0.
3. Click "Güncelle". Confirm the dialog closes and the row now shows stock 0 / "Tükendi" status.
4. Reopen the dialog on that now-zero row. Confirm the new button is disabled.

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/inventory/adjust-stock.tsx"
git commit -m "$(cat <<'EOF'
Add one-click "mark out of stock" action to the inventory adjust dialog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Mağaza — "Stokta yok" ibaresi

**Files:**
- Modify: `components/shop/product-entry.tsx`
- Modify: `components/shop/product-detail.tsx`

**Interfaces:**
- Consumes: existing `available`/`inStock(product)` booleans already computed in both files — no change to that logic.
- Produces: nothing consumed by later tasks; Task 5 will later replace the *image-badge* markup added here with a CSS-variable-driven version, but the underneath text line added here in `product-entry.tsx` is final and untouched by Task 5.

- [ ] **Step 1: Update the image badge + add the underneath line in `product-entry.tsx`**

Find:

```tsx
          {!available && (
            <span className="absolute left-0 top-0 bg-ivory/95 px-3 py-1.5">
              <span className="label text-clay">Tükendi</span>
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="label text-olive">{categoryLabel(product.category)}</p>
          <h2 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
            {product.name}
          </h2>
          <p className="mt-3 flex items-baseline gap-3">
            <span className="figure text-lg text-ink">
              {formatTL(product.price)}
            </span>
            {discounted && (
              <span className="figure text-sm text-olive line-through">
                {formatTL(product.originalPrice!)}
              </span>
            )}
          </p>
        </div>
```

Replace with:

```tsx
          {!available && (
            <span className="absolute left-0 top-0 bg-ivory/95 px-3 py-1.5">
              <span className="label text-clay">Stokta yok</span>
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="label text-olive">{categoryLabel(product.category)}</p>
          <h2 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
            {product.name}
          </h2>
          <p className="mt-3 flex items-baseline gap-3">
            <span className="figure text-lg text-ink">
              {formatTL(product.price)}
            </span>
            {discounted && (
              <span className="figure text-sm text-olive line-through">
                {formatTL(product.originalPrice!)}
              </span>
            )}
          </p>
          {!available && <p className="mt-2 label text-clay">Stokta yok</p>}
        </div>
```

- [ ] **Step 2: Update the two "Tükendi" strings in `product-detail.tsx`**

Find:

```tsx
            {!available && (
              <span className="absolute left-0 top-0 bg-ivory/95 px-4 py-2">
                <span className="label text-clay">Tükendi</span>
              </span>
            )}
```

Replace with:

```tsx
            {!available && (
              <span className="absolute left-0 top-0 bg-ivory/95 px-4 py-2">
                <span className="label text-clay">Stokta yok</span>
              </span>
            )}
```

Find:

```tsx
              ) : available ? (
                <>
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Sepete ekle
                </>
              ) : (
                "Tükendi"
              )}
```

Replace with:

```tsx
              ) : available ? (
                <>
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Sepete ekle
                </>
              ) : (
                "Stokta yok"
              )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With the dev server running on port 3100 (`npm run dev -- -p 3100`), visit `/magaza` and the product detail page (`/urun/<slug>`) of a product with a zero-stock variant (use the button from Task 1 to zero one out if none exists yet). Confirm:
- The shop grid card shows "Stokta yok" both as the small tag on the image and as its own line under the price.
- The product detail page shows "Stokta yok" as the image tag and as the disabled button's label.

- [ ] **Step 5: Commit**

```bash
git add components/shop/product-entry.tsx components/shop/product-detail.tsx
git commit -m "$(cat <<'EOF'
Show "Stokta yok" wording clearly on out-of-stock product cards and detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Theme engine data model — `stockBadge` override group

**Files:**
- Modify: `lib/theme-engine/types.ts`
- Modify: `lib/theme-engine/schema.ts`
- Modify: `lib/theme-engine/resolve.ts`
- Test: `tests/theme-engine-resolver.test.ts`

**Interfaces:**
- Produces (consumed by Task 4 and Task 5):
  - Types `StockBadgeTone`, `StockBadgeFill`, `StockBadgePosition` from `lib/theme-engine/types.ts`.
  - `ThemeOverrides.stockBadge?: { visible?: boolean; tone?: StockBadgeTone; fill?: StockBadgeFill; position?: StockBadgePosition; inset?: number; radius?: number }`.
  - CSS variables on `ResolvedTheme.vars`: `--theme-stock-badge-display`, `--theme-stock-badge-color`, `--theme-stock-badge-bg`, `--theme-stock-badge-border`, `--theme-stock-badge-radius`, `--theme-stock-badge-top`, `--theme-stock-badge-right`, `--theme-stock-badge-bottom`, `--theme-stock-badge-left`.

- [ ] **Step 1: Write the failing resolver tests**

Append to the end of `tests/theme-engine-resolver.test.ts`:

```ts
describe("stockBadge overrides", () => {
  it("resolves the default stock badge (visible, clay, solid, top-left, 8px inset, 0 radius)", () => {
    const r = resolveDefaultTheme()
    assert.equal(r.vars["--theme-stock-badge-display"], "inline-block")
    assert.equal(r.vars["--theme-stock-badge-color"], "var(--color-clay)")
    assert.equal(r.vars["--theme-stock-badge-bg"], "color-mix(in srgb, var(--color-ivory) 95%, transparent)")
    assert.equal(r.vars["--theme-stock-badge-border"], "none")
    assert.equal(r.vars["--theme-stock-badge-radius"], "0px")
    assert.equal(r.vars["--theme-stock-badge-top"], "8px")
    assert.equal(r.vars["--theme-stock-badge-left"], "8px")
    assert.equal(r.vars["--theme-stock-badge-right"], "auto")
    assert.equal(r.vars["--theme-stock-badge-bottom"], "auto")
  })

  it("applies a stockBadge override and leaves unrelated groups untouched", () => {
    const r = resolveTheme({
      ...DEFAULT_THEME_CONFIG,
      overrides: {
        stockBadge: { position: "bottom-right", inset: 4, tone: "ink", fill: "outline", visible: false },
        radius: { button: 2 },
      },
    })
    assert.equal(r.vars["--theme-stock-badge-display"], "none")
    assert.equal(r.vars["--theme-stock-badge-color"], "var(--color-ink)")
    assert.equal(r.vars["--theme-stock-badge-bg"], "transparent")
    assert.equal(r.vars["--theme-stock-badge-border"], "1px solid currentColor")
    assert.equal(r.vars["--theme-stock-badge-bottom"], "4px")
    assert.equal(r.vars["--theme-stock-badge-right"], "4px")
    assert.equal(r.vars["--theme-stock-badge-top"], "auto")
    assert.equal(r.vars["--theme-stock-badge-left"], "auto")
    assert.equal(r.vars["--theme-radius-button"], "2px")
  })

  it("resolves the text fill variant with a transparent background and no border", () => {
    const r = resolveTheme({
      ...DEFAULT_THEME_CONFIG,
      overrides: { stockBadge: { fill: "text", radius: 12 } },
    })
    assert.equal(r.vars["--theme-stock-badge-bg"], "transparent")
    assert.equal(r.vars["--theme-stock-badge-border"], "none")
    assert.equal(r.vars["--theme-stock-badge-radius"], "12px")
  })

  it("rejects an out-of-allowlist stockBadge inset", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: { stockBadge: { inset: 5 } },
    })
    assert.equal(cfg, null)
  })

  it("rejects an unknown stockBadge tone", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: { stockBadge: { tone: "purple" } },
    })
    assert.equal(cfg, null)
  })

  it("rejects an out-of-allowlist stockBadge radius", () => {
    const cfg = parseThemeConfig({
      schemaVersion: 1,
      shapePreset: "balanced",
      typographyProfile: "kabia_original",
      fonts: { body: "instrument_sans", display: "instrument_serif" },
      overrides: { stockBadge: { radius: 7 } },
    })
    assert.equal(cfg, null)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — the new `describe("stockBadge overrides")` assertions fail (`r.vars["--theme-stock-badge-display"]` is `undefined`, and the two `parseThemeConfig` rejection tests fail because an unknown `stockBadge` key is currently stripped rather than rejected by `.strict()`, so `cfg` is not `null`).

- [ ] **Step 3: Add the types**

In `lib/theme-engine/types.ts`, find:

```ts
export type ShadowStrength = "none" | "subtle" | "medium" | "strong";
```

Replace with:

```ts
export type ShadowStrength = "none" | "subtle" | "medium" | "strong";

export type StockBadgeTone = "clay" | "ink" | "brand" | "olive" | "shell";
export type StockBadgeFill = "solid" | "outline" | "text";
export type StockBadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
```

Then find:

```ts
  density?: {
    interface?: DensityLevel;
    sectionSpacing?: DensityLevel;
    pageGutter?: PageSizeGutter;
  };
}
```

Replace with:

```ts
  density?: {
    interface?: DensityLevel;
    sectionSpacing?: DensityLevel;
    pageGutter?: PageSizeGutter;
  };
  stockBadge?: {
    visible?: boolean;
    tone?: StockBadgeTone;
    fill?: StockBadgeFill;
    position?: StockBadgePosition;
    inset?: number;
    radius?: number;
  };
}
```

- [ ] **Step 4: Add schema validation**

In `lib/theme-engine/schema.ts`, find:

```ts
const iconScales = ["compact", "balanced", "large"] as const;
```

Replace with:

```ts
const iconScales = ["compact", "balanced", "large"] as const;
const stockBadgeTones = ["clay", "ink", "brand", "olive", "shell"] as const;
const stockBadgeFills = ["solid", "outline", "text"] as const;
const stockBadgePositions = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
const stockBadgeInsets = [0, 2, 4, 8, 12, 16] as const;
const stockBadgeInsetHas = (v: number) => (stockBadgeInsets as readonly number[]).includes(v);
```

Then find:

```ts
    density: z
      .object({
        interface: optionalEnum(densityLevels),
        sectionSpacing: optionalEnum(densityLevels),
        pageGutter: optionalEnum(gutters),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional()
  .default({});
```

Replace with:

```ts
    density: z
      .object({
        interface: optionalEnum(densityLevels),
        sectionSpacing: optionalEnum(densityLevels),
        pageGutter: optionalEnum(gutters),
      })
      .strict()
      .optional(),
    stockBadge: z
      .object({
        visible: z.boolean().optional(),
        tone: optionalEnum(stockBadgeTones),
        fill: optionalEnum(stockBadgeFills),
        position: optionalEnum(stockBadgePositions),
        inset: numField("kenar boşluğu", stockBadgeInsetHas),
        radius: numField("yarıçap", radiusHas),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional()
  .default({});
```

Because every nested override object in this schema uses `.strict()`, an unrecognized key (or an unrecognized *value* the allowlist checks reject) now fails validation instead of being silently stripped — matching how `radius`/`border`/etc. already behave, and satisfying the two rejection tests from Step 1.

- [ ] **Step 5: Add the resolver logic**

In `lib/theme-engine/resolve.ts`, find:

```ts
import { getPreset, type ShapePresetTokens } from "@/lib/theme-engine/presets";
import { resolveBodyFontVar, resolveDisplayFontVar } from "@/lib/theme-engine/fonts";
import { parseThemeConfig } from "@/lib/theme-engine/schema";
import { DEFAULT_THEME_CONFIG, type DensityLevel, type ShadowStrength, type ThemeConfiguration } from "@/lib/theme-engine/types";
```

Replace with:

```ts
import { getPreset, type ShapePresetTokens } from "@/lib/theme-engine/presets";
import { resolveBodyFontVar, resolveDisplayFontVar } from "@/lib/theme-engine/fonts";
import { parseThemeConfig } from "@/lib/theme-engine/schema";
import {
  DEFAULT_THEME_CONFIG,
  type DensityLevel,
  type ShadowStrength,
  type StockBadgeFill,
  type StockBadgePosition,
  type StockBadgeTone,
  type ThemeConfiguration,
} from "@/lib/theme-engine/types";
```

Find:

```ts
const SHADOW_VALUE: Record<ShadowStrength, string> = {
  none: "none",
  subtle: "0 1px 2px 0 color-mix(in srgb, var(--color-ink) 8%, transparent)",
  medium: "0 4px 12px -2px color-mix(in srgb, var(--color-ink) 12%, transparent)",
  strong: "0 12px 32px -6px color-mix(in srgb, var(--color-ink) 16%, transparent)",
};
```

Replace with:

```ts
const SHADOW_VALUE: Record<ShadowStrength, string> = {
  none: "none",
  subtle: "0 1px 2px 0 color-mix(in srgb, var(--color-ink) 8%, transparent)",
  medium: "0 4px 12px -2px color-mix(in srgb, var(--color-ink) 12%, transparent)",
  strong: "0 12px 32px -6px color-mix(in srgb, var(--color-ink) 16%, transparent)",
};

/** The badge has no preset variation — one fixed default set, purely override-driven. */
const STOCK_BADGE_DEFAULTS = {
  visible: true,
  tone: "clay" as StockBadgeTone,
  fill: "solid" as StockBadgeFill,
  position: "top-left" as StockBadgePosition,
  inset: 8,
  radius: 0,
};

const STOCK_BADGE_TONE_VAR: Record<StockBadgeTone, string> = {
  clay: "var(--color-clay)",
  ink: "var(--color-ink)",
  brand: "var(--color-brand)",
  olive: "var(--color-olive)",
  shell: "var(--color-shell)",
};

const STOCK_BADGE_FILL_STYLE: Record<StockBadgeFill, { bg: string; border: string }> = {
  solid: { bg: "color-mix(in srgb, var(--color-ivory) 95%, transparent)", border: "none" },
  outline: { bg: "transparent", border: "1px solid currentColor" },
  text: { bg: "transparent", border: "none" },
};

/** Which two sides carry the inset for a given corner; the other two are "auto". */
function stockBadgeSides(
  position: StockBadgePosition,
  inset: number,
): { top: string; right: string; bottom: string; left: string } {
  const px = `${inset}px`;
  switch (position) {
    case "top-left":
      return { top: px, left: px, right: "auto", bottom: "auto" };
    case "top-right":
      return { top: px, right: px, left: "auto", bottom: "auto" };
    case "bottom-left":
      return { bottom: px, left: px, top: "auto", right: "auto" };
    case "bottom-right":
      return { bottom: px, right: px, top: "auto", left: "auto" };
  }
}
```

Now find:

```ts
  const heights = DENSITY_HEIGHTS[density.interface];
  const icons = ICON_SIZE[icon.sizeScale];
```

Replace with:

```ts
  const heights = DENSITY_HEIGHTS[density.interface];
  const icons = ICON_SIZE[icon.sizeScale];

  const stockBadge = {
    visible: ov.stockBadge?.visible ?? STOCK_BADGE_DEFAULTS.visible,
    tone: ov.stockBadge?.tone ?? STOCK_BADGE_DEFAULTS.tone,
    fill: ov.stockBadge?.fill ?? STOCK_BADGE_DEFAULTS.fill,
    position: ov.stockBadge?.position ?? STOCK_BADGE_DEFAULTS.position,
    inset: ov.stockBadge?.inset ?? STOCK_BADGE_DEFAULTS.inset,
    radius: ov.stockBadge?.radius ?? STOCK_BADGE_DEFAULTS.radius,
  };
  const stockBadgeSidesResolved = stockBadgeSides(stockBadge.position, stockBadge.inset);
  const stockBadgeFillResolved = STOCK_BADGE_FILL_STYLE[stockBadge.fill];
```

Finally, find:

```ts
    // Fonts (map selected ids → approved CSS variables, fallback-safe)
    "--font-body": resolveBodyFontVar(config.fonts.body),
    "--font-display": resolveDisplayFontVar(config.fonts.display),
  };
```

Replace with:

```ts
    // Fonts (map selected ids → approved CSS variables, fallback-safe)
    "--font-body": resolveBodyFontVar(config.fonts.body),
    "--font-display": resolveDisplayFontVar(config.fonts.display),

    // Out-of-stock badge
    "--theme-stock-badge-display": stockBadge.visible ? "inline-block" : "none",
    "--theme-stock-badge-color": STOCK_BADGE_TONE_VAR[stockBadge.tone],
    "--theme-stock-badge-bg": stockBadgeFillResolved.bg,
    "--theme-stock-badge-border": stockBadgeFillResolved.border,
    "--theme-stock-badge-radius": `${stockBadge.radius}px`,
    "--theme-stock-badge-top": stockBadgeSidesResolved.top,
    "--theme-stock-badge-right": stockBadgeSidesResolved.right,
    "--theme-stock-badge-bottom": stockBadgeSidesResolved.bottom,
    "--theme-stock-badge-left": stockBadgeSidesResolved.left,
  };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/theme-engine-resolver.test.ts`, including the new `stockBadge overrides` block.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/theme-engine/types.ts lib/theme-engine/schema.ts lib/theme-engine/resolve.ts tests/theme-engine-resolver.test.ts
git commit -m "$(cat <<'EOF'
Add stockBadge theme override group: types, schema validation, CSS-variable resolver

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Görünüm paneli — "Stok rozeti" kontrol grubu

**Files:**
- Modify: `components/theme/fine-tune-controls.tsx`

**Interfaces:**
- Consumes: `StockBadgeTone`, `StockBadgeFill`, `StockBadgePosition` types and the `stockBadge` field on `ThemeOverrides` (Task 3). Uses the existing generic `applyOverride`/`resetGroup` from `lib/theme-engine/editor-logic.ts` via the `onOverride`/`onResetGroup` props already threaded through this component — no changes needed there.
- Produces: nothing new consumed by other files; this closes the loop so an admin can set `stockBadge` overrides from the UI, which `AppearanceEditor`'s existing save/publish flow already persists unchanged.

- [ ] **Step 1: Import the new types**

In `components/theme/fine-tune-controls.tsx`, find:

```tsx
import type {
  DensityLevel,
  IconSizeScale,
  PageSizeGutter,
  ShadowStrength,
  ThemeConfiguration,
  ThemeOverrides,
} from "@/lib/theme-engine/types"
```

Replace with:

```tsx
import type {
  DensityLevel,
  IconSizeScale,
  PageSizeGutter,
  ShadowStrength,
  StockBadgeFill,
  StockBadgePosition,
  StockBadgeTone,
  ThemeConfiguration,
  ThemeOverrides,
} from "@/lib/theme-engine/types"
```

- [ ] **Step 2: Add labels and the allowlist constants**

Find:

```tsx
const ICON_SCALE_LABELS: Record<IconSizeScale, string> = {
  compact: "Kompakt",
  balanced: "Dengeli",
  large: "Geniş",
}
```

Replace with:

```tsx
const ICON_SCALE_LABELS: Record<IconSizeScale, string> = {
  compact: "Kompakt",
  balanced: "Dengeli",
  large: "Geniş",
}
const STOCK_BADGE_VISIBILITY_VALUES = ["true", "false"] as const
const STOCK_BADGE_VISIBILITY_LABELS: Record<"true" | "false", string> = {
  true: "Göster",
  false: "Gizle",
}
const STOCK_BADGE_TONE_VALUES: StockBadgeTone[] = ["clay", "ink", "brand", "olive", "shell"]
const STOCK_BADGE_TONE_LABELS: Record<StockBadgeTone, string> = {
  clay: "Kil",
  ink: "İnk",
  brand: "Marka",
  olive: "Zeytin",
  shell: "Kabuk",
}
const STOCK_BADGE_FILL_VALUES: StockBadgeFill[] = ["solid", "outline", "text"]
const STOCK_BADGE_FILL_LABELS: Record<StockBadgeFill, string> = {
  solid: "Dolu",
  outline: "Anahat",
  text: "Sade metin",
}
const STOCK_BADGE_POSITION_VALUES: StockBadgePosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"]
const STOCK_BADGE_POSITION_LABELS: Record<StockBadgePosition, string> = {
  "top-left": "Sol üst",
  "top-right": "Sağ üst",
  "bottom-left": "Sol alt",
  "bottom-right": "Sağ alt",
}
const STOCK_BADGE_INSET_VALUES = [0, 2, 4, 8, 12, 16]
```

- [ ] **Step 3: Add the "Stok rozeti" group**

Find:

```tsx
      <Group legend="Yoğunluk" onReset={() => onResetGroup("density")}>
        <Segmented label="Arayüz yoğunluğu" value={ov.density?.interface as DensityLevel | undefined} values={["compact", "balanced", "spacious"]} labels={DENSITY_LABELS} defaultValue={preset.density.interface} onChange={(v) => onOverride({ group: "density", key: "interface", value: v })} />
        <Segmented label="Bölüm aralığı" value={ov.density?.sectionSpacing as DensityLevel | undefined} values={["compact", "balanced", "spacious"]} labels={DENSITY_LABELS} defaultValue={preset.density.sectionSpacing} onChange={(v) => onOverride({ group: "density", key: "sectionSpacing", value: v })} />
        <Segmented label="Sayfa kenar boşluğu" value={ov.density?.pageGutter as PageSizeGutter | undefined} values={["compact", "balanced", "wide"]} labels={GUTTER_LABELS} defaultValue={preset.density.pageGutter} onChange={(v) => onOverride({ group: "density", key: "pageGutter", value: v })} />
      </Group>
    </div>
  )
}
```

Replace with:

```tsx
      <Group legend="Yoğunluk" onReset={() => onResetGroup("density")}>
        <Segmented label="Arayüz yoğunluğu" value={ov.density?.interface as DensityLevel | undefined} values={["compact", "balanced", "spacious"]} labels={DENSITY_LABELS} defaultValue={preset.density.interface} onChange={(v) => onOverride({ group: "density", key: "interface", value: v })} />
        <Segmented label="Bölüm aralığı" value={ov.density?.sectionSpacing as DensityLevel | undefined} values={["compact", "balanced", "spacious"]} labels={DENSITY_LABELS} defaultValue={preset.density.sectionSpacing} onChange={(v) => onOverride({ group: "density", key: "sectionSpacing", value: v })} />
        <Segmented label="Sayfa kenar boşluğu" value={ov.density?.pageGutter as PageSizeGutter | undefined} values={["compact", "balanced", "wide"]} labels={GUTTER_LABELS} defaultValue={preset.density.pageGutter} onChange={(v) => onOverride({ group: "density", key: "pageGutter", value: v })} />
      </Group>

      <Group
        legend="Stok rozeti"
        description="Ürün görseli üzerindeki 'Stokta yok' rozetinin görünümü. Kartın altındaki metin satırı bundan etkilenmez, her zaman görünür."
        onReset={() => onResetGroup("stockBadge")}
      >
        <Segmented
          label="Görünürlük"
          value={ov.stockBadge?.visible === undefined ? undefined : ov.stockBadge.visible ? "true" : "false"}
          values={STOCK_BADGE_VISIBILITY_VALUES}
          labels={STOCK_BADGE_VISIBILITY_LABELS}
          defaultValue="true"
          onChange={(v) => onOverride({ group: "stockBadge", key: "visible", value: v === "true" })}
        />
        <Segmented
          label="Renk"
          value={ov.stockBadge?.tone}
          values={STOCK_BADGE_TONE_VALUES}
          labels={STOCK_BADGE_TONE_LABELS}
          defaultValue="clay"
          onChange={(v) => onOverride({ group: "stockBadge", key: "tone", value: v })}
        />
        <Segmented
          label="Dolgu"
          value={ov.stockBadge?.fill}
          values={STOCK_BADGE_FILL_VALUES}
          labels={STOCK_BADGE_FILL_LABELS}
          defaultValue="solid"
          onChange={(v) => onOverride({ group: "stockBadge", key: "fill", value: v })}
        />
        <Segmented
          label="Konum"
          value={ov.stockBadge?.position}
          values={STOCK_BADGE_POSITION_VALUES}
          labels={STOCK_BADGE_POSITION_LABELS}
          defaultValue="top-left"
          onChange={(v) => onOverride({ group: "stockBadge", key: "position", value: v })}
        />
        <Segmented
          label="Kenar boşluğu"
          value={ov.stockBadge?.inset}
          values={STOCK_BADGE_INSET_VALUES}
          defaultValue={8}
          onChange={(v) => onOverride({ group: "stockBadge", key: "inset", value: v })}
        />
        <Segmented
          label="Köşe yuvarlaklığı"
          value={ov.stockBadge?.radius}
          values={RADIUS_VALUES}
          defaultValue={0}
          onChange={(v) => onOverride({ group: "stockBadge", key: "radius", value: v })}
        />
      </Group>
    </div>
  )
}
```

This reuses the file's existing generic `Segmented<T extends number | string>` control for every field, including the boolean visibility toggle (represented as the strings `"true"`/`"false"` in the UI, converted to a real boolean in the `onChange` callback before it reaches `onOverride` — the same string-boolean convention `settingValueSchemas.boolean` already uses elsewhere in the admin). No new UI primitive is introduced.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification**

With the dev server on port 3100, go to `/admin/appearance`. Confirm a new "Stok rozeti" panel appears after "Yoğunluk" with six controls (Görünürlük, Renk, Dolgu, Konum, Kenar boşluğu, Köşe yuvarlaklığı), each showing "Göster"/"clay"/"Dolu"/"Sol üst"/"8"/"0" as their current (default) value, and "Grubu sıfırla" works after changing any of them.

- [ ] **Step 6: Commit**

```bash
git add components/theme/fine-tune-controls.tsx
git commit -m "$(cat <<'EOF'
Add "Stok rozeti" controls to the appearance Fine-Tune panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Storefront badge — mağaza görsel rozetini tema değişkenlerine bağla

**Files:**
- Modify: `components/shop/product-entry.tsx`
- Modify: `components/shop/product-detail.tsx`

**Interfaces:**
- Consumes: the CSS variables produced in Task 3 (`--theme-stock-badge-*`), rendered onto `:root` by the existing `<ThemeVars>` (`app/layout.tsx`) and, in the admin draft preview, onto `.theme-preview-scope` (`app/admin/(protected)/appearance/preview/page.tsx`) — no changes needed to either of those, they already pass through whatever `resolveTheme` returns.
- Produces: nothing consumed elsewhere; this is the final integration step.

- [ ] **Step 1: Wire the badge in `product-entry.tsx`**

Find (the version left by Task 2):

```tsx
          {!available && (
            <span className="absolute left-0 top-0 bg-ivory/95 px-3 py-1.5">
              <span className="label text-clay">Stokta yok</span>
            </span>
          )}
```

Replace with:

```tsx
          {!available && (
            <span
              className="absolute px-3 py-1.5"
              style={{
                display: "var(--theme-stock-badge-display)",
                top: "var(--theme-stock-badge-top)",
                right: "var(--theme-stock-badge-right)",
                bottom: "var(--theme-stock-badge-bottom)",
                left: "var(--theme-stock-badge-left)",
                backgroundColor: "var(--theme-stock-badge-bg)",
                border: "var(--theme-stock-badge-border)",
                borderRadius: "var(--theme-stock-badge-radius)",
              }}
            >
              <span className="label" style={{ color: "var(--theme-stock-badge-color)" }}>
                Stokta yok
              </span>
            </span>
          )}
```

- [ ] **Step 2: Wire the badge in `product-detail.tsx`**

Find:

```tsx
            {!available && (
              <span className="absolute left-0 top-0 bg-ivory/95 px-4 py-2">
                <span className="label text-clay">Stokta yok</span>
              </span>
            )}
```

Replace with:

```tsx
            {!available && (
              <span
                className="absolute px-4 py-2"
                style={{
                  display: "var(--theme-stock-badge-display)",
                  top: "var(--theme-stock-badge-top)",
                  right: "var(--theme-stock-badge-right)",
                  bottom: "var(--theme-stock-badge-bottom)",
                  left: "var(--theme-stock-badge-left)",
                  backgroundColor: "var(--theme-stock-badge-bg)",
                  border: "var(--theme-stock-badge-border)",
                  borderRadius: "var(--theme-stock-badge-radius)",
                }}
              >
                <span className="label" style={{ color: "var(--theme-stock-badge-color)" }}>
                  Stokta yok
                </span>
              </span>
            )}
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed. The build is the real check here — it statically renders every route, so a bad CSS variable reference or a `ThemeVars` mismatch would surface as a build-time render error, not just a type error.

- [ ] **Step 4: Manual round-trip verification**

With the dev server on port 3100:

1. Visit `/magaza` **and** the detail page of a variant zeroed out via Task 1. Confirm the badge still reads clay text on a translucent ivory chip with square corners (no visible rounding) — same colors/shape as before this task — but now sits ~8px in from the top-left corner of the image instead of flush against it. That 8px gap is the new default (`inset: 8`, replacing the old hardcoded `left-0 top-0`) and is the intended, requested change; everything else about the default look is unchanged, just now driven by the theme engine instead of hardcoded classes.
2. Go to `/admin/appearance`, open "Stok rozeti", set Renk → "Marka", Dolgu → "Anahat", Konum → "Sağ alt", Köşe yuvarlaklığı → "8". Click "Taslağı kaydet".
3. Go to `/admin/appearance` → "Tam siteyi önizle". On a real out-of-stock product card in the preview, confirm the badge is now an outlined brand-colored chip with rounded corners, sitting in the bottom-right of the image.
4. Back in the editor, click "Yayınla" (confirm the dialog). Revisit `/magaza` (outside the preview) and confirm the published storefront now shows the same updated badge.
5. Set Görünürlük → "Gizle", save + publish, and confirm the image badge disappears from `/magaza` while the "Stokta yok" line under the product name/price stays visible — proving the two are decoupled as specified.
6. Restore the panel to its defaults (Görünürlük → Göster, Renk → Kil, Dolgu → Dolu, Konum → Sol üst, Kenar boşluğu → 8, Köşe yuvarlaklığı → 0), save and publish again, so the site is left in its intended default state.

- [ ] **Step 5: Commit**

```bash
git add components/shop/product-entry.tsx components/shop/product-detail.tsx
git commit -m "$(cat <<'EOF'
Wire the out-of-stock image badge to the theme engine's stockBadge overrides

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
