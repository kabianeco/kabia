# Shop Hero Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single, admin-managed, full-bleed promotional banner at the very top of `/shop`, above the existing "Mağaza" title, that is invisible by default and controlled entirely from the admin "İçerik" screen.

**Architecture:** No new table. Extend the existing `public.site_settings` key/value store (the pattern already used for the announcement bar and SEO defaults) with six `shop_banner_*` rows. A pure helper (`lib/shop-banner.ts`) decides visibility from those values; `app/shop/page.tsx` reads the settings once, decides whether to render, and passes plain props to a new presentational component (`components/shop/shop-hero-banner.tsx`). The admin panel reuses the existing generic `SettingsGroupForm`/`updateSettingsAction` — no new admin form code is needed beyond wiring the new group in.

**Tech Stack:** Next.js 16 (App Router, RSC), Supabase (Postgres + `site_settings` RLS), Tailwind v4, TypeScript, Node's built-in `node --test` runner (see `tests/alias-hook.mjs`).

## Global Constraints

- Reuse `public.site_settings`; do not create a new table. (Design spec, "Veri modeli".)
- All admin/UI copy is Turkish, matching the rest of the codebase.
- The banner is **off by default** (`shop_banner_enabled = false`, all text fields `""`) — applying this plan must not change the live site's appearance until an admin configures and enables it.
- The CTA is optional: if `cta_label` or `cta_href` is empty, no button is rendered.
- The banner renders nothing at all (`null`) unless `enabled` is true **and** both `headline` and `image_url` are non-empty.
- `.tsx` files are not resolvable by this repo's test runner (`tests/alias-hook.mjs`: "`.tsx` is deliberately not in the candidate list... Node does not transform JSX"). Any logic that needs a unit test must live in a plain `.ts` module; React components stay untested by `node --test` and are verified with `npm run typecheck`, `npm run lint`, and manual/browser checks instead.
- Run `npm run typecheck` after every task that touches `.ts`/`.tsx` files.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/20260801220000_shop_banner_settings.sql` | Create | Adds `shop_banner` to the `group_key` check constraint and inserts the 6 setting rows. |
| `lib/settings.ts` | Modify | Adds the 6 new fields to `PublicSettings`, `SETTINGS_FALLBACK`, `KEY_MAP`. |
| `lib/shop-banner.ts` | Create | Pure type (`ShopBannerSettings`) + `shopBannerVisible()` — the one piece of new logic that gets a unit test. |
| `components/shop/shop-hero-banner.tsx` | Create | Presentational full-bleed banner section. Assumes valid content (caller already checked visibility). |
| `app/globals.css` | Modify | Adds `.banner-top`, a header-clearing padding utility without `.page-top`'s extra breathing room. |
| `app/shop/page.tsx` | Modify | Fetches settings, decides visibility once, renders the banner and adjusts the title block's top spacing. |
| `app/admin/(protected)/content/page.tsx` | Modify | Adds a "Mağaza banner'ı" panel using the existing `SettingsGroupForm`. |
| `app/admin/(protected)/settings/actions.ts` | Modify | Audit log labels a `shop_banner` group change as `content.update`, same as `content`. |
| `tests/shop-banner.test.ts` | Create | Unit tests for `shopBannerVisible()`. |

---

### Task 1: Database migration — `shop_banner` settings group

**Files:**
- Create: `supabase/migrations/20260801220000_shop_banner_settings.sql`

**Interfaces:**
- Produces: 6 rows in `public.site_settings` with keys `shop_banner_enabled` (boolean), `shop_banner_headline`, `shop_banner_subtext`, `shop_banner_image_url`, `shop_banner_cta_label`, `shop_banner_cta_href` (all string), all `group_key = 'shop_banner'`, `is_public = true`, `is_sensitive = false`. These keys are what Task 2's `KEY_MAP` and Task 5's admin panel both depend on — do not rename them.

- [ ] **Step 1: Write the migration file**

```sql
-- ---------------------------------------------------------------------------
-- Shop page hero banner.
--
-- Extends the site_settings key/value model (see 20260801000700_site_settings.sql)
-- with a single admin-managed promotional banner shown above the product grid
-- on /shop. No new table: this is exactly the "operationally editable content"
-- site_settings already exists for.
--
-- Rollback: drop the six shop_banner_* rows and revert the group_key check
-- constraint to its previous list. lib/settings.ts falls back to
-- shopBannerEnabled: false when the rows are missing, so removing them just
-- hides the banner rather than breaking the shop page.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  drop constraint if exists site_settings_group_key_check;

alter table public.site_settings
  add constraint site_settings_group_key_check
  check (group_key in ('general', 'inventory', 'shipping', 'store', 'content', 'seo', 'shop_banner'));

insert into public.site_settings (key, value, value_type, label, group_key, is_public, is_sensitive) values
  ('shop_banner_enabled',   'false'::jsonb, 'boolean', 'Banner yayında', 'shop_banner', true, false),
  ('shop_banner_headline',  '""'::jsonb,    'string',  'Başlık',         'shop_banner', true, false),
  ('shop_banner_subtext',   '""'::jsonb,    'string',  'Alt metin',      'shop_banner', true, false),
  ('shop_banner_image_url', '""'::jsonb,    'string',  'Görsel URL',     'shop_banner', true, false),
  ('shop_banner_cta_label', '""'::jsonb,    'string',  'Buton metni',    'shop_banner', true, false),
  ('shop_banner_cta_href',  '""'::jsonb,    'string',  'Buton linki',    'shop_banner', true, false)
on conflict (key) do nothing;
```

- [ ] **Step 2: Apply the migration to the project's Supabase database**

Use the Supabase MCP tool `mcp__plugin_supabase_supabase__apply_migration` with `name: "shop_banner_settings"` and `query` set to the exact SQL above.

- [ ] **Step 3: Verify the rows landed correctly**

Use `mcp__plugin_supabase_supabase__execute_sql` with:

```sql
select key, value, value_type, group_key, is_public, is_sensitive
from public.site_settings
where group_key = 'shop_banner'
order by key;
```

Expected: 6 rows, keys exactly `shop_banner_cta_href`, `shop_banner_cta_label`, `shop_banner_enabled`, `shop_banner_headline`, `shop_banner_image_url`, `shop_banner_subtext` (alphabetical from the `order by key`), `shop_banner_enabled` has `value = false`, the rest have `value = ""`.

Also confirm nothing else broke:

```sql
select count(*) from public.site_settings;
```

Expected: previous row count + 6.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260801220000_shop_banner_settings.sql
git commit -m "$(cat <<'EOF'
Add shop_banner settings group for the shop page hero banner

Extends the existing site_settings key/value store rather than adding
a new table, matching how the announcement bar and SEO defaults are
already modeled.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Settings plumbing — `lib/settings.ts` + `lib/shop-banner.ts`

**Files:**
- Modify: `lib/settings.ts`
- Create: `lib/shop-banner.ts`
- Test: `tests/shop-banner.test.ts`

**Interfaces:**
- Consumes: the 6 `shop_banner_*` keys from Task 1.
- Produces:
  - `PublicSettings` (in `lib/settings.ts`) gains: `shopBannerEnabled: boolean`, `shopBannerHeadline: string`, `shopBannerSubtext: string`, `shopBannerImageUrl: string`, `shopBannerCtaLabel: string`, `shopBannerCtaHref: string`.
  - `lib/shop-banner.ts` exports `interface ShopBannerSettings { enabled: boolean; headline: string; subtext: string; imageUrl: string; ctaLabel: string; ctaHref: string }` and `function shopBannerVisible(settings: ShopBannerSettings): boolean`. Task 3 and Task 4 both import from here.

- [ ] **Step 1: Write the failing test**

Create `tests/shop-banner.test.ts`:

```typescript
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { shopBannerVisible, type ShopBannerSettings } from "../lib/shop-banner.ts"

const base = (): ShopBannerSettings => ({
  enabled: true,
  headline: "Hasat başladı",
  subtext: "Bu haftanın taze bademi",
  imageUrl: "/images/almonds-drying.jpg",
  ctaLabel: "Şimdi incele",
  ctaHref: "/shop?kategori=cig-badem",
})

describe("shopBannerVisible", () => {
  it("is visible when enabled with a headline and an image", () => {
    assert.equal(shopBannerVisible(base()), true)
  })

  it("is hidden when disabled, even with full content", () => {
    assert.equal(shopBannerVisible({ ...base(), enabled: false }), false)
  })

  it("is hidden when the headline is empty", () => {
    assert.equal(shopBannerVisible({ ...base(), headline: "" }), false)
  })

  it("is hidden when the headline is only whitespace", () => {
    assert.equal(shopBannerVisible({ ...base(), headline: "   " }), false)
  })

  it("is hidden when the image URL is empty", () => {
    assert.equal(shopBannerVisible({ ...base(), imageUrl: "" }), false)
  })

  it("stays visible without a CTA — the button is optional", () => {
    assert.equal(
      shopBannerVisible({ ...base(), ctaLabel: "", ctaHref: "" }),
      true,
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern=shopBannerVisible`

Expected: FAIL — `Cannot find module '../lib/shop-banner.ts'` (or similar), since the module doesn't exist yet.

- [ ] **Step 3: Implement `lib/shop-banner.ts`**

```typescript
/**
 * Shop page hero banner — pure visibility rule.
 *
 * Kept free of any database or Next.js import so it can be unit tested
 * directly (this repo's test runner does not transform .tsx, so any logic
 * worth testing has to live in a plain .ts module like this one).
 */

export interface ShopBannerSettings {
  enabled: boolean
  headline: string
  subtext: string
  imageUrl: string
  ctaLabel: string
  ctaHref: string
}

/** The banner needs to be turned on and have at least a headline and an image. */
export function shopBannerVisible(settings: ShopBannerSettings): boolean {
  return (
    settings.enabled &&
    settings.headline.trim() !== "" &&
    settings.imageUrl.trim() !== ""
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --test-name-pattern=shopBannerVisible`

Expected: PASS, 6 tests.

- [ ] **Step 5: Extend `lib/settings.ts`**

In `lib/settings.ts`, add the 6 fields to `PublicSettings` (after `seoSocialImage: string`, line 46):

```typescript
  seoSocialImage: string
  shopBannerEnabled: boolean
  shopBannerHeadline: string
  shopBannerSubtext: string
  shopBannerImageUrl: string
  shopBannerCtaLabel: string
  shopBannerCtaHref: string
}
```

Add matching defaults to `SETTINGS_FALLBACK` (after `seoSocialImage: "/images/almonds-drying.jpg",`, line 71):

```typescript
  seoSocialImage: "/images/almonds-drying.jpg",
  shopBannerEnabled: false,
  shopBannerHeadline: "",
  shopBannerSubtext: "",
  shopBannerImageUrl: "",
  shopBannerCtaLabel: "",
  shopBannerCtaHref: "",
}
```

Add the key mappings to `KEY_MAP` (after `seo_social_image: "seoSocialImage",`, line 96):

```typescript
  seo_social_image: "seoSocialImage",
  shop_banner_enabled: "shopBannerEnabled",
  shop_banner_headline: "shopBannerHeadline",
  shop_banner_subtext: "shopBannerSubtext",
  shop_banner_image_url: "shopBannerImageUrl",
  shop_banner_cta_label: "shopBannerCtaLabel",
  shop_banner_cta_href: "shopBannerCtaHref",
}
```

No other change to `lib/settings.ts` is needed — `readPublicSettings()` already loops over every row and applies `KEY_MAP` generically.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`

Expected: no errors. (This is the only verification for the `lib/settings.ts` edit — it has no existing test file, and importing it directly from `node --test` is avoided because it pulls in `next/cache`, which is not safe outside the Next.js runtime.)

- [ ] **Step 7: Commit**

```bash
git add lib/settings.ts lib/shop-banner.ts tests/shop-banner.test.ts
git commit -m "$(cat <<'EOF'
Add shop banner fields to PublicSettings and a visibility rule

shopBannerVisible() is the single source of truth for "should the
banner render" — both the page and (indirectly) the component depend
on it so the rule can't drift between the two.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `ShopHeroBanner` component + `.banner-top` CSS utility

**Files:**
- Modify: `app/globals.css` (right after the existing `.page-top` block, ~line 232–242)
- Create: `components/shop/shop-hero-banner.tsx`

**Interfaces:**
- Consumes: `ShopBannerSettings` type shape from `lib/shop-banner.ts` (Task 2) — specifically the 5 content fields, not `enabled`.
- Produces: `ShopHeroBannerProps` (exported), `ShopHeroBanner` component. Task 4 imports both.

- [ ] **Step 1: Add the `.banner-top` utility to `app/globals.css`**

Insert immediately after the existing `.page-top` block's closing `@media` rule and before the `.figure` comment/rule:

```css
/* Same header clearance as .page-top, without the extra breathing room —
   for full-bleed sections (like the shop hero banner) that want to start
   right at the header's edge instead of leaving a gap under it. */
.banner-top {
  padding-top: var(--header-offset, 4rem);
}

@media (min-width: 768px) {
  .banner-top {
    padding-top: var(--header-offset-desktop, 5rem);
  }
}
```

- [ ] **Step 2: Create `components/shop/shop-hero-banner.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";
import type { ShopBannerSettings } from "@/lib/shop-banner";

export type ShopHeroBannerProps = Pick<
  ShopBannerSettings,
  "headline" | "subtext" | "imageUrl" | "ctaLabel" | "ctaHref"
>;

/**
 * Full-bleed promotional banner at the very top of the shop page.
 *
 * Assumes it is only rendered when headline and imageUrl are non-empty —
 * see shopBannerVisible() in lib/shop-banner.ts, which the caller checks
 * before mounting this component at all.
 */
export function ShopHeroBanner({
  headline,
  subtext,
  imageUrl,
  ctaLabel,
  ctaHref,
}: ShopHeroBannerProps) {
  const showCta = ctaLabel.trim() !== "" && ctaHref.trim() !== "";

  return (
    <section aria-labelledby="shop-banner-heading" className="on-dark">
      <div className="banner-top">
        <div className="relative h-[420px] w-full overflow-hidden md:h-[560px]">
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent"
          />
          <div className="wrap relative flex h-full flex-col justify-end pb-12 md:pb-16">
            <h2
              id="shop-banner-heading"
              className="max-w-2xl text-3xl leading-[1.1] tracking-tight text-cream md:text-5xl"
            >
              {headline}
            </h2>
            {subtext.trim() !== "" && (
              <p className="mt-4 max-w-md text-base leading-relaxed text-cream/80">
                {subtext}
              </p>
            )}
            {showCta && (
              <Link
                href={ctaHref}
                className="mt-7 inline-block w-fit rounded-full bg-cream px-8 py-4 text-sm font-medium text-forest transition-colors duration-300 hover:bg-ivory"
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npx eslint components/shop/shop-hero-banner.tsx app/globals.css`

Expected: no errors. (No `node --test` coverage for this file — it's a `.tsx` component; see Global Constraints.)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/shop/shop-hero-banner.tsx
git commit -m "$(cat <<'EOF'
Add ShopHeroBanner component and its header-clearance CSS utility

Full-bleed image with an overlaid headline/subtext/CTA, styled to
match the site's existing on-dark full-width sections (FinalCta).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the banner into `app/shop/page.tsx`

**Files:**
- Modify: `app/shop/page.tsx`

**Interfaces:**
- Consumes: `getPublicSettings()` (`lib/settings.ts`), `shopBannerVisible` + `ShopBannerSettings` (`lib/shop-banner.ts`), `ShopHeroBanner` (`components/shop/shop-hero-banner.tsx`).

- [ ] **Step 1: Add imports**

At the top of `app/shop/page.tsx`, after the existing `import { routes } from "@/lib/site";` (line 10):

```tsx
import { routes } from "@/lib/site";
import { getPublicSettings } from "@/lib/settings";
import { shopBannerVisible, type ShopBannerSettings } from "@/lib/shop-banner";
import { ShopHeroBanner } from "@/components/shop/shop-hero-banner";
```

- [ ] **Step 2: Fetch settings and compute visibility**

In `ShopPage`, replace:

```tsx
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; sirala?: string }>;
}) {
  const { kategori, sirala } = await searchParams;
  const sort: SortOption = isSort(sirala) ? sirala : "onerilen";
```

with:

```tsx
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; sirala?: string }>;
}) {
  const { kategori, sirala } = await searchParams;
  const settings = await getPublicSettings();
  const banner: ShopBannerSettings = {
    enabled: settings.shopBannerEnabled,
    headline: settings.shopBannerHeadline,
    subtext: settings.shopBannerSubtext,
    imageUrl: settings.shopBannerImageUrl,
    ctaLabel: settings.shopBannerCtaLabel,
    ctaHref: settings.shopBannerCtaHref,
  };
  const showBanner = shopBannerVisible(banner);
  const sort: SortOption = isSort(sirala) ? sirala : "onerilen";
```

- [ ] **Step 3: Render the banner and adjust the title block's spacing**

Replace:

```tsx
  return (
    <PageShell>
      <section aria-labelledby="shop-heading">
        <div className="wrap page-top">
```

with:

```tsx
  return (
    <PageShell>
      {showBanner && (
        <ShopHeroBanner
          headline={banner.headline}
          subtext={banner.subtext}
          imageUrl={banner.imageUrl}
          ctaLabel={banner.ctaLabel}
          ctaHref={banner.ctaHref}
        />
      )}
      <section aria-labelledby="shop-heading">
        <div className={showBanner ? "wrap mt-14 md:mt-20" : "wrap page-top"}>
```

(No other lines in the file change — the rest of `ShopPage`, `ProductGrid`, `GridSkeleton`, etc. are untouched.)

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npx eslint app/shop/page.tsx`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/shop/page.tsx
git commit -m "$(cat <<'EOF'
Render the shop hero banner above the product grid when configured

Visibility and title-block spacing both derive from one
shopBannerVisible() check, so they can't disagree with each other.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Admin panel + audit label

**Files:**
- Modify: `app/admin/(protected)/content/page.tsx`
- Modify: `app/admin/(protected)/settings/actions.ts:100`

**Interfaces:**
- Consumes: `SettingsGroupForm` (existing, `app/admin/(protected)/settings/settings-form.tsx`) — no changes to that component.
- Produces: nothing new consumed elsewhere — this is the last task on the admin side.

- [ ] **Step 1: Add the panel to the content page**

In `app/admin/(protected)/content/page.tsx`, insert a new `SettingsGroupForm` between the existing "Duyuru ve iletişim" form and the "Anasayfa seçkisi" `Panel`. Replace:

```tsx
      <div className="space-y-6">
        <SettingsGroupForm
          group="content"
          title="Duyuru ve iletişim"
          description="Duyuru bandı açıldığında mağazanın üst kısmında görünür."
          settings={groups.content ?? []}
          canEditSensitive={canEditSensitive}
          longFields={["announcement_text"]}
        />

        <Panel
          title="Anasayfa seçkisi"
```

with:

```tsx
      <div className="space-y-6">
        <SettingsGroupForm
          group="content"
          title="Duyuru ve iletişim"
          description="Duyuru bandı açıldığında mağazanın üst kısmında görünür."
          settings={groups.content ?? []}
          canEditSensitive={canEditSensitive}
          longFields={["announcement_text"]}
        />

        <SettingsGroupForm
          group="shop_banner"
          title="Mağaza banner'ı"
          description="Mağaza sayfasının en üstünde gösterilen kampanya banner'ı. Görseli önce Medya kütüphanesine yükleyip URL'sini buraya yapıştırın."
          settings={groups.shop_banner ?? []}
          canEditSensitive={canEditSensitive}
          longFields={["shop_banner_subtext"]}
        />

        <Panel
          title="Anasayfa seçkisi"
```

No import changes are needed — `SettingsGroupForm` is already imported in this file, and `loadSettingsByGroup` already groups every `site_settings` row by `group_key` generically, so `groups.shop_banner` is populated automatically once Task 1's migration has run.

- [ ] **Step 2: Label `shop_banner` changes as content updates in the audit log**

In `app/admin/(protected)/settings/actions.ts`, line 100, replace:

```typescript
      action: group === "content" ? "content.update" : "settings.update",
```

with:

```typescript
      action:
        group === "content" || group === "shop_banner"
          ? "content.update"
          : "settings.update",
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npx eslint "app/admin/(protected)/content/page.tsx" "app/admin/(protected)/settings/actions.ts"`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(protected)/content/page.tsx" "app/admin/(protected)/settings/actions.ts"
git commit -m "$(cat <<'EOF'
Add shop banner admin panel to the Content screen

Reuses the existing generic SettingsGroupForm / updateSettingsAction —
no new form component or server action needed. shop_banner edits are
audited as content.update, same as the announcement bar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only — no commit at the end of this task).

**Interfaces:** none produced; this task consumes the whole feature.

- [ ] **Step 1: Confirm the default (disabled) state changes nothing**

Run `npm run dev` in the background. Navigate to `/shop`. Confirm the page looks exactly as it did before this plan: "Mağaza / Bahçeden sofraya" heading starts right under the header, no banner, no layout shift.

- [ ] **Step 2: Configure sample banner content**

Use `mcp__plugin_supabase_supabase__execute_sql`:

```sql
update public.site_settings set value = 'true'::jsonb where key = 'shop_banner_enabled';
update public.site_settings set value = '"Hasat başladı"'::jsonb where key = 'shop_banner_headline';
update public.site_settings set value = '"Bu haftanın taze bademi, bahçeden doğrudan sofranıza."'::jsonb where key = 'shop_banner_subtext';
update public.site_settings set value = '"/images/almonds-drying.jpg"'::jsonb where key = 'shop_banner_image_url';
update public.site_settings set value = '"Şimdi incele"'::jsonb where key = 'shop_banner_cta_label';
update public.site_settings set value = '"/shop"'::jsonb where key = 'shop_banner_cta_href';
```

- [ ] **Step 3: Verify the public shop page**

Reload `/shop` (the settings read is cached for 300s / tagged with `SETTINGS_TAG` — if it doesn't show up immediately, restart the dev server). Confirm:
- The banner fills the viewport width, sits directly under the header (no gap, no overlap).
- Headline, subtext and a "Şimdi incele" button are all legible over the image.
- Clicking the CTA navigates to `/shop`.
- The "Mağaza" heading below the banner has normal spacing, not doubled.
- Resize to a mobile width and confirm the banner is shorter but still legible and the header still clears it.

- [ ] **Step 4: Verify the admin panel**

Log into `/admin/content`. Confirm:
- A "Mağaza banner'ı" panel appears below "Duyuru ve iletişim", showing the values set in Step 2.
- Clearing "Buton metni" and saving removes the CTA button from `/shop` on reload, while the banner itself stays visible.
- Turning "Banner yayında" off and saving makes the banner disappear from `/shop` entirely, with the title block returning to its original spacing.

- [ ] **Step 5: Reset to the shipped default**

```sql
update public.site_settings set value = 'false'::jsonb where key = 'shop_banner_enabled';
update public.site_settings set value = '""'::jsonb
where key in ('shop_banner_headline', 'shop_banner_subtext', 'shop_banner_image_url', 'shop_banner_cta_label', 'shop_banner_cta_href');
```

Confirm `/shop` is back to looking exactly as it did in Step 1.

- [ ] **Step 6: Run the full test suite once more**

Run: `npm test && npm run typecheck`

Expected: all tests pass (including the 6 new `shopBannerVisible` tests), no type errors.
