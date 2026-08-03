# Theme Engine — Operations

Operational reference for the controlled appearance engine at `/admin/appearance`.

## Appearance route

`/admin/appearance` — the editor. Guarded by the `manageTheme` permission
(`admin` + `super_admin`). The admin nav shows it as **Görünüm** (with a
palette icon), between İçerik and Ayarlar. The full-site preview lives at
`/admin/appearance/preview`.

## Preset definitions

Three presets, defined in `lib/theme-engine/presets.ts` (code, not the
database). See `docs/theme-engine-architecture.md` for the exact token table.
Turkish names: Keskin (`sharp`), Dengeli (`balanced`), Yumuşak (`soft`).
`balanced` is the default: `sharp` is 0 on every radius token, `soft` is
generous on every token except card (kept deliberately more restrained), and
`balanced` sits in between with "a little" radius everywhere.

## Font allowlist

Body/interface: `instrument_sans`, `manrope`, `dm_sans`, `source_sans_3`.
Editorial/display: `instrument_serif`, `fraunces`, `cormorant_garamond`, `lora`.
Loaded statically in `lib/fonts.ts` via `next/font/google` (`latin` +
`latin-ext` for Turkish glyphs).

## Typography profiles

`kabia_original` (Instrument Sans + Instrument Serif, default),
`modern_clean` (Manrope + Instrument Serif),
`warm_editorial` (Source Sans 3 + Cormorant Garamond),
`soft_contemporary` (DM Sans + Fraunces). Defined in
`lib/theme-engine/profiles.ts`. Selecting a profile sets both font roles;
afterwards the body and display fonts can be adjusted independently. The
editor warns (but allows) a custom combination that differs from the selected
profile.

## Token groups

Radius (button, image, productImage, card, input, dialog, badge, navigation,
iconContainer), border (width, opacity, headerDividerOpacity), shadow (card,
image, dialog, floatingNavigation), icon (strokeWidth, sizeScale), density
(interface, sectionSpacing, pageGutter). Each group can be reset
independently; "Preset varsayılanlarına sıfırla" clears all overrides.

## Component classification

- **Theme-responsive**: `components/ui/button.tsx` (radius + height),
  `components/cart/order-summary.tsx` (card radius + shadow),
  `components/layout/site-header.tsx` (divider opacity), all `rounded-media`
  photographic surfaces (via the `--radius-media` redirection: editorial
  images, blog, cart, checkout, homepage, account — ~18 sites), the shop grid
  and product-detail gallery/thumbnails (`rounded-theme-product-image`,
  independent of `rounded-media`), the product-detail weight/variant
  selector, the shop hero banner CTA, the homepage hero/final-CTA/intro-
  sequence buttons, the blog search field (`rounded-theme-input`), blog share
  + pagination buttons, the footer's social icon buttons
  (`rounded-theme-icon-container`), ~15 display-typography sites migrated to
  `font-theme-display`: `components/home/brand-manifesto.tsx`,
  `brand-quote.tsx`, `final-cta.tsx`, `kabia-transition.tsx`,
  `principles.tsx`, `intro-sequence.tsx` (4 sites),
  `components/auth/auth-shell.tsx`, `components/shop/product-detail.tsx`
  (empty-reviews), `app/giris/page.tsx`, `app/kayit/page.tsx`,
  `app/shop/page.tsx` (2 sites).
- **Theme-limited**: the public header/footer, editorial images,
  product-detail layout, checkout/auth panels — respond within safe limits
  inherited from the responsive primitives.
- **Theme-fixed** (intentionally not themed): the Three.js almond scene
  (`components/home/almond-scene.tsx`) and its SVG fallback
  (`almond-figure.tsx`), full-bleed `bg-forest` panels, the
  `kabia-transition` veil's forest ground, circular avatars/dots, the toggle
  switch thumb/track, the cart badge, `animate-pulse` skeletons, and the
  **admin operational shell** (`AdminShell`, admin `Panel`/`AdminButton`/
  admin controls — they keep their `rounded-[4px]`/`rounded-[3px]` look so a
  heavily-rounded public theme never reshapes the dashboard). `rounded-full`
  for genuine pills/dots/avatars/toggles is left untouched.

## `rounded-theme-*` / `shadow-theme-*` CSS wiring (fixed 2026-08-03)

These Tailwind utilities and the `--radius-media` / `--font-sans`
redirections described above are registered in `app/globals.css` via
`@utility` rules and `@theme` redeclarations. If a shape/typography change in
`/admin/appearance` stops visibly affecting the public site again, check
`app/globals.css` first — the utility class or a redirection may have been
dropped or overwritten, in which case the class exists in markup but resolves
to no CSS rule at all (Tailwind silently ignores unknown utility names, so
this fails silently rather than throwing).

## Deferred phase-two candidates

Cart stepper controls, the checkout step indicator, account navigation, the
mobile header menu's serif links, and the remaining `font-serif` functional
usages (card-preview network label, account nav user name, order-status step
numbers) are deliberately **not** migrated to keep the diff bounded and avoid
the blind replacement the spec warns against. They inherit the body font
through `--font-sans` already; a future pass may opt them into
`rounded-theme-*` / `font-theme-display` individually after visual review.

## Draft workflow

1. Pick a preset card, a typography profile, and/or fine-tune tokens. The live
   preview (right column) updates immediately with **no** database writes.
2. **Taslağı kaydet** persists the working config as the draft. Status bar
   shows: Yayında (published preset + version), Taslak (saved draft preset),
   Kaydedilmedi (working differs from saved draft).
3. **Tam siteyi önizle** sets the short-lived preview cookie and opens
   `/admin/appearance/preview` — the real site rendered with the draft.
4. **Yayınla** (confirmed) promotes the draft atomically.
5. **Taslak değişiklikleri geri al** discards the draft (the editor reloads to
   the published config).
6. **Preset varsayılanlarına sıfırla** clears overrides locally (then save +
   publish to make it live).

Drafts persist across reloads (stored in the singleton). Unsaved local changes
survive a page reload only until the editor is reloaded from the server; the
"Kaydedilmedi" indicator makes the state clear.

## Publishing workflow

`publishThemeFormAction` → `adminContext("manageTheme")` →
`supabase.rpc("publish_site_theme", { p_note })`. The RPC validates the draft,
writes an immutable revision for the new version, updates `published_config`,
increments `published_version`, synchronizes the draft, records the actor,
and writes a `theme.publish` audit event. Then the application calls
`updateTag(SITE_THEME_TAG)`, `revalidatePath("/", "layout")`,
`revalidatePath("/magaza")`, `revalidatePath("/shop")`,
`revalidatePath("/admin/appearance")`,
`revalidatePath("/admin/appearance/preview")`.

## Full-site preview

`/admin/appearance/preview`. Three gates: valid Supabase session, current
admin/super_admin role (re-read from `user_roles`), and a valid HMAC-signed
`kabia_appearance_preview` token bound to the current user's ID (HttpOnly,
SameSite=Lax, Secure in production, `Path=/admin/appearance/preview`,
10-minute Max-Age). A revoked administrator loses access on the next request
(the cookie alone is not enough). Missing, invalid, expired, and
subject-mismatched tokens cause one redirect to `/admin/appearance`; they are
not rewritten during rendering. "Önizlemeyi kapat" runs `leavePreviewAction`,
which deletes only that path-scoped cookie and redirects once to the editor.
Product links inside the preview navigate to the real public shop (published
theme) — noted in the preview banner.

## Revision restoration

`restoreRevisionFormAction` (confirmed in `ConfirmAction`) →
`restore_site_theme_version(p_version, p_note)`. Copies the historical config
forward as a new version; never mutates history. Writes a
`theme.revision_restore` audit event and revalidates the public theme.

## Cache invalidation

Storefront: `unstable_cache` reader `getPublishedTheme()` tagged
`SITE_THEME_TAG = "site-theme"` (300 s backstop). Publish/restore call
`updateTag(SITE_THEME_TAG)` (the synchronous Next 15 API, mirroring the
settings flow) plus `revalidatePath`. Only successful explicit mutations
invalidate the cache. Read failures use the balanced fallback for the current
request and are never cached, written, or invalidated. Drafts are never cached
publicly.

## RLS behavior

- anon: no SELECT on either table; can call only `get_published_site_theme()`
  (returns `published_config` alone). Cannot save/publish/restore.
- authenticated customer (no admin role): same as anon for these tables.
- admin / super_admin: SELECT the singleton (published + draft) and revisions.
  All writes go through the definer RPCs, which re-check the role.

## Audit behavior

Six new actions in `lib/admin/audit.ts`: `theme.draft_save`, `theme.publish`,
`theme.reset`, `theme.preset_change`, `theme.font_change`,
`theme.revision_restore`. The RPCs write `theme.publish` and
`theme.revision_restore` server-side (server-derived actor via `auth.uid()`);
`theme.draft_save` is written by the save action. Metadata records the
preset/profile/fonts/version diff — never raw CSS or the generated `<style>`.
No administrator identity is ever accepted from the client.

## Adding a new preset

1. Add the id to `ShapePresetId` in `lib/theme-engine/types.ts` and a
   `SHAPE_PRESETS` entry in `lib/theme-engine/presets.ts` with the full token
   table.
2. Add it to the `SHAPE_PRESET_IDS` enum consumed by `schema.ts`
   (`Object.keys(SHAPE_PRESETS)` handles this automatically).
3. Add a card to `components/theme/preset-cards.tsx` (the loop is data-driven,
   so it appears once the preset is defined).
4. No database migration — presets live in code.

## Adding an approved font

1. Add the static `next/font/google` import + `.variable` to `lib/fonts.ts`
   (use literal `subsets: ["latin", "latin-ext"]`, weights limited to actual
   use) and add it to `ALL_FONT_VARIABLES`.
2. Add the id + `cssVar` + role to `FONTS` in `lib/theme-engine/fonts.ts`.
3. Add the id to `BodyFontId` / `DisplayFontId` in `types.ts`.
4. Optionally reference it in a typography profile (`profiles.ts`).
5. No database migration — the allowlist is in code; unknown ids fall back
   safely.

## Removing a font safely

Removing a font from `fonts.ts`/`types.ts` makes any stored row or historical
revision that still references it resolve to the Kabia Original fallback
(`resolveBodyFontVar` / `resolveDisplayFontVar` handle unknown ids). No data
migration is required; audit/revision readability is preserved.

## Theme-schema migration

`ThemeConfiguration.schemaVersion` is `1`. To introduce v2, add a coerce step
in `parseThemeConfig` (`lib/theme-engine/schema.ts`): detect an old
`schemaVersion`, transform the shape into the current one, then re-validate
with `themeConfigSchema`. Stored revisions remain readable because the
resolver validates any config and falls back to the default only on failure
(the DB RPC's `is_valid_theme_config` is a coarse defence-in-depth; the Zod
schema is the authoritative validator the application uses).

## Recovery procedure

- If Supabase is unavailable, the storefront degrades to the default
  balanced + Kabia Original theme (`getPublishedTheme()` returns the
  fallback; the cached reader returns `null` on failure, so the fallback is
  never persisted as the cached value).
- To reset the theme to the default seed, run (as an admin) the editor's
  "Preset varsayılanlarına sıfırla" → save → publish; or from SQL, set
  `published_config`/`draft_config` to the default JSONB and
  `published_version = 1` (disable the append-only trigger first if you need
  to trim test revisions, then re-enable it).
- A super_admin can also restore any prior published version from the
  revision history.

## Known limitations

- Colors remain fixed (phase 1).
- No jsdom/React component test harness — interactive UI behavior is covered
  by pure logic tests (`lib/theme-engine/editor-logic.ts`) and manual browser
  verification.
- Preview product links navigate to the live public shop (published theme).
