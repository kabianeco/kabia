# Theme Engine Architecture

The controlled appearance engine lets authorized administrators reshape the
public-facing Kabia design — shape, typography, borders, shadows, icon
sizing, density — from `/admin/appearance` without turning the application
into a page builder. It is **controlled**: an approved vocabulary, server-side
resolution, validated storage, and a sharp separation between what the public
sees (the published configuration) and what an administrator is shaping (the
draft).

Colors are intentionally **fixed** in this phase. The existing premium Kabia
palette in `app/globals.css` remains authoritative.

## Design-token architecture before this work

Before the theme engine, the design vocabulary lived in `app/globals.css`:

- A fixed brand palette (`--color-forest`, `--color-cream`,
  `--color-on-brand`) that never flips with the light/dark surface.
- Themed color aliases (`--surface`, `--text`, `--brand`, …) that re-point in
  dark mode (`lib/theme.tsx` writes `data-theme` on `<html>`). This light/dark
  surface theme is **separate** from the appearance engine and is untouched.
- One radius token, `--radius-media: 5px`, mapped to the Tailwind v4
  `rounded-media` utility — used by ~20 photographic surfaces on the public
  site. Buttons and badges were `rounded-full`; admin panels used arbitrary
  `rounded-[4px]` / `rounded-[3px]`.
- No Tailwind `shadow-*` utilities anywhere; only `boxShadow: "none"` on toasts
  and chart tooltips, plus Three.js `ContactShadows`.
- Two `next/font/google` fonts (Instrument Sans body, Instrument Serif
  display), loaded in `app/layout.tsx`, mapped to `--font-sans` / `--font-serif`.

There was **no operator control** of any of these values.

## What the engine adds

A typed, validated, versioned `ThemeConfiguration`:

```text
schemaVersion
shapePreset        sharp | balanced | soft
typographyProfile  kabia_original | modern_clean | warm_editorial | soft_contemporary
fonts.body         instrument_sans | manrope | dm_sans | source_sans_3
fonts.display      instrument_serif | fraunces | cormorant_garamond | lora
overrides          radius / border / shadow / icon / density (all optional)
```

The final theme is **resolved**, never stored as a blob:

```text
base tokens (compiled in)
+ selected shape preset       (lib/theme-engine/presets.ts)
+ selected typography profile  (lib/theme-engine/profiles.ts)
+ validated overrides
```

Complete preset definitions live in code (`lib/theme-engine/presets.ts`), so a
preset can be refined centrally without a data migration and a stored row can
never drift from the approved vocabulary. The database stores **only**
identifiers and overrides — never complete preset definitions, never raw CSS.

## Preset architecture

Three presets (`lib/theme-engine/presets.ts`), each with component-specific
radii (not one universal value), restrained shadows, and a density:

| Token | sharp (Keskin) | balanced (Dengeli) | soft (Yumuşak) |
|---|---|---|---|
| radius.button | 0px | 8px | 999px (pill) |
| radius.image / productImage | 0px | 5px | 32px |
| radius.card | 0px | 10px | 16px |
| radius.input | 0px | 6px | 20px |
| radius.dialog | 0px | 10px | 28px |
| radius.badge | 0px | 8px | 999px |
| radius.navigation | 0px | 6px | 20px |
| radius.iconContainer | 0px | 6px | 16px |
| border.width / opacity | 1px / 0.24 | 1px / 0.18 | 1px / 0.12 |
| shadow.card | none | subtle | medium |
| shadow.image | none | none | subtle |
| shadow.dialog | subtle | medium | strong |
| shadow.floatingNavigation | subtle | medium | strong |
| icon.strokeWidth | 1.4 | 1.6 | 1.75 |
| density.interface | compact | balanced | spacious |

`sharp` is literally zero on every radius token — architectural, no rounding
anywhere. `soft` pushes every token generous **except card**, which is kept
deliberately more restrained than the rest so cards read as a distinct
surface rather than blending into the same pill-everything look. `balanced`
sits in between with a small, "a little" radius on every token rather than
reproducing the old pill-button default; card/image/input keep their
original values (10px / 5px / 6px) since those already read as "a little."
`radius.image` / `radius.productImage` are independent tokens: `Görsel`
governs every other photographic surface (`rounded-media`, ~18 sites —
editorial images, blog, cart, checkout, homepage), while `Ürün görseli`
(`rounded-theme-product-image`) governs specifically the shop grid and
product-detail gallery/thumbnails, so an operator can shape product photos
independently of the rest of the site's imagery.

## Font architecture

`lib/fonts.ts` imports **all** approved fonts statically through
`next/font/google`. Each emits a private CSS variable (`--font-<id>`); all nine
`.variable` classNames are applied to `<html>` so every `@font-face` exists.
Only the fonts referenced by `--font-body` / `--font-display` are actually
downloaded by the browser.

Font roles:

```text
--font-body    = selected body/interface font
--font-display = selected editorial/display font
--font-sans    = var(--font-body)              — the body default
--font-serif   = fixed Instrument Serif        — prices, labels, figures
```

The editorial font drives **only selected display moments** (hero serif
accents, `BrandQuote`, the intro wordmark, major display headings). Prices,
labels and `.figure` numerals stay on the fixed `--font-serif` so the
signature price typeface never swaps. This is enforced by a dedicated
`font-theme-display` utility and ~15 explicit migration sites (see "Components
migrated" in the operations doc); `font-serif` was never blindly redirected.

Rules:
- No dynamic `next/font` imports. No runtime Google Fonts stylesheet injection.
- No administrator-supplied CSS `font-family` strings ever reach CSS — only
  approved identifiers (`instrument_sans`, …) are stored, resolved server-side
  by `lib/theme-engine/fonts.ts` to `var(--font-…)`.
- Unknown identifiers fall back to the Kabia Original pair.
- Every font loads `latin` + `latin-ext` (Turkish glyphs: ç, ğ, ı, İ, ö, ş, ü),
  weights limited to what the app uses (400/500/600 body, 400 + italic display).

## Database architecture

Two tables back the editor (migration
`supabase/migrations/20260801200000_theme_engine.sql`, plus
`20260801210000_theme_engine_revision_model_fix.sql` which corrected the
revision-insert model):

- `public.site_theme_settings` — a singleton (`site_key = 'default'`) holding
  `published_config`, `draft_config`, `published_version`, `schema_version`,
  and actor/timestamp fields.
- `public.site_theme_revisions` — append-only history; a row's `version = N`
  holds the configuration that was published **as** version N. A trigger
  refuses UPDATE/DELETE. Restoring version 3 while current is 6 creates a new
  version 7 containing version 3's config — history is never mutated.

**Security**: anon has no SELECT on either table. The public site reads the
published theme **only** through `get_published_site_theme()` (SECURITY
DEFINER, returns `published_config` alone). Mutations happen **only** through
`save_site_theme_draft`, `discard_site_theme_draft`, `publish_site_theme`,
`restore_site_theme_version` — all SECURITY DEFINER, all re-derive the actor
from `auth.uid()` + `user_roles` inside their own body. No client-supplied
administrator identity is ever accepted. See `docs/theme-engine-database-changes.md`.

## Draft and publishing model

```text
Select preset → adjust typography/tokens → preview locally
→ Save draft → (optional) full-site preview → Publish
```

- Draft changes are visible only to authorized administrators and never affect
  public visitors. Saving a draft does not publish it. Drafts persist across
  reloads (stored in the DB singleton).
- Publishing is **atomic** inside the `publish_site_theme()` RPC: validate the
  draft → write an immutable revision for the new version → update
  `published_config` → increment the version → synchronize/clear the draft →
  record actor + timestamps → write an audit event. Partial publication is
  impossible. The application then calls `updateTag(SITE_THEME_TAG)` and
  `revalidatePath("/", "layout")` to bust the tagged cache.

## Preview strategy

Two preview surfaces, both scoped:

1. **Live component preview** (`components/theme/preview-canvas.tsx`) — a
   `<div data-theme-scope>` whose inline style sets the `--theme-*` variables
   for its subtree only. Unsaved edits re-render it immediately with **zero**
   database writes; the rest of the admin shell is unaffected.
2. **Full-site preview** (`/admin/appearance/preview`) — a protected route
   that composes real public components (`SiteHeader`, real `ProductEntry`s
   from the DB, `Button`, `SiteFooter`) inside a `.theme-preview-scope` subtree
   that stamps the **draft** variables via an SSR `<style>`. Three gates must
   pass: a valid Supabase session, a current admin/super_admin role, and a
   short-lived, HMAC-signed `kabia_appearance_preview` cookie bound to that
   administrator's user ID (HttpOnly, SameSite=Lax, Secure in production,
   `Path=/admin/appearance/preview`, 10-minute Max-Age). Missing, malformed,
   expired, or subject-mismatched tokens produce one terminal redirect back to
   the editor. The cookie is never read by `/admin/appearance`, `/magaza`, or
   any other public route. Preview never mutates the published theme and never
   exposes a public draft URL.

## Revision strategy

Revisions are append-only. The history panel (`components/theme/revision-history.tsx`)
lists each published version with its preset/profile/fonts, publication date
and note. Restoring runs `restore_site_theme_version()` which copies the
historical config forward as a brand-new version (never rewrites history),
writes a `theme.revision_restore` audit event, and revalidates the public
theme.

## Cache strategy

The storefront reads the published theme once at the shell boundary via
`getPublishedTheme()` (`lib/theme-settings.ts`). A successful validated read is
wrapped in `unstable_cache`, keyed by `["kabia-site-theme"]` and tagged
`SITE_THEME_TAG = "site-theme"`, with a 5-minute revalidation backstop. Missing
rows, Supabase failures, and invalid JSON throw out of the cached reader; the
request boundary logs a safe server-side diagnostic and uses the balanced
theme for that request only. A failed read therefore cannot become the
authoritative cached value and never writes or invalidates data. Publish/restore
call `updateTag(SITE_THEME_TAG)` (the Next 15
synchronous variant, matching the existing settings flow) plus targeted
`revalidatePath` calls. No per-component fetch; the resolved vars are stamped
on `:root` by an SSR `<style>` in `app/layout.tsx`.

## Public theme-loading architecture

`app/layout.tsx` awaits `getPublishedTheme()` once, then renders
`<ThemeVars theme={...} />` in `<head>` — an SSR `<style id="kabia-theme-vars">`
that overrides the `:root` defaults from `globals.css`. The first paint already
carries the operator's chosen preset and fonts: **no flash, no `useEffect`,
no client fetch.**

## CSS variable + Tailwind integration

`app/globals.css` adds the `--theme-*` semantic variables on `:root`
(defaults = balanced + Kabia Original), and registers Tailwind v4 `@utility`
entries: `rounded-theme-button`, `rounded-theme-image`,
`rounded-theme-product-image`, `rounded-theme-card`, `rounded-theme-input`,
`rounded-theme-dialog`, `rounded-theme-badge`, `rounded-theme-navigation`,
`rounded-theme-icon-container`, `shadow-theme-card`, `shadow-theme-image`,
`shadow-theme-dialog`, `shadow-theme-floating-navigation`, `font-theme-body`,
`font-theme-display`. Two redirections provide site-wide coverage from a
single CSS edit:

```css
--radius-media: var(--theme-radius-image, 5px);
--font-sans:    var(--font-body, var(--font-instrument-sans)), system-ui, sans-serif;
```

So all ~20 `rounded-media` sites and all body text become theme-responsive
without a per-file rewrite, while explicit migrations opt individual
components in by name.

## Component classification

Every relevant public component belongs to one of three groups (full list in
`docs/theme-engine-operations.md`):

- **Theme-responsive** — fully follows theme tokens: `Button`, `OrderSummary`
  card, product images (`rounded-media`), the public header divider, display
  typography sites.
- **Theme-limited** — responds within safe limits: the public header/footer,
  editorial images, product-detail layout.
- **Theme-fixed** — structurally fixed: the Three.js almond experience
  (`components/home/almond-scene.tsx`), the SVG almond fallback, full-bleed
  `bg-forest` panels, the `kabia-transition` veil, circular avatars/dots,
  badges that must remain pills, `animate-pulse` skeletons, the **admin
  operational shell**. `rounded-full` for genuine pills/dots is intentionally
  left on `rounded-full`, not `rounded-theme-badge`, where it must stay
  circular regardless of preset.

The radius tokens are **not** applied blindly to every element.

## Security boundaries

- Server: every mutation re-derives the actor via `adminContext("manageTheme")`.
- Database: the RPCs re-check `auth.uid()` + `user_roles`; no INSERT/UPDATE/
  DELETE policy exists on either table, so direct PostgREST writes are
  impossible; revisions are append-only.
- Cache: drafts are never cached publicly; the tagged cache stores only
  validated published results.
- Fonts: only approved identifiers are stored; the resolver maps them to
  `var(--font-…)`. No arbitrary CSS, no remote URLs, no uploaded fonts.

## Schema versioning

`ThemeConfiguration.schemaVersion` is `1`. The schema (`lib/theme-engine/schema.ts`)
is the boundary for stored JSON: it enumerates approved identifiers,
constrains override values to fixed allowlists, and derives fonts from the
selected profile when `fonts` is absent (old-row safety). `resolveThemeSafe`
validates and falls back to the default on any failure. Future schema versions
should add a migration step in `parseThemeConfig` (coerce older shapes) before
producing the current `ThemeConfiguration`; see the operations doc.

## Migration plan (executed)

1. Typed theme tokens + Zod schema.
2. CSS `--theme-*` variables + Tailwind utilities; defaults = current design.
3. `app/layout.tsx` SSR `<ThemeVars>` — confirmed site unchanged.
4. Shared primitives: `Button` (radius + height), header divider, `OrderSummary`
   card, badges.
5. ~15 display-font sites → `font-theme-display`.
6. Three.js, full-bleed sections, circular avatars, skeletons marked fixed.
7. Admin editor + preview + revisions.
8. Database migration + RPCs applied via Supabase MCP.

At initial launch the default `balanced` + Kabia Original publish reproduced
the pre-engine design pixel-for-pixel (pill buttons, 5px media radius). A
follow-up revision changed `balanced.radius.button`/`badge` from a 999px pill
to 8px ("a little" radius) so the three presets read as three genuinely
distinct shapes rather than "sharp vs. two variants of pill" — see the preset
table above. Selecting `balanced` today is no longer a guaranteed visual
no-op against the original pre-engine site; it is simply one of the three
maintained presets.

## Known limitations

- Colors remain fixed (phase 1).
- Interactive UI behavior (preset selection, live preview) is covered by pure
  logic tests (`lib/theme-engine/editor-logic.ts`) and manual browser checks;
  there is no jsdom/React component test harness in this project.
- Inside the full-site preview, product links navigate to the real public shop
  (which shows the **published** theme) — expected and noted in the preview
  banner.
- The pre-existing `react-hooks/set-state-in-effect` lint errors in
  `orders/[orderId]/order-controls.tsx` and `categories/page.tsx`'s unused
  import were present before this work and are left untouched.
