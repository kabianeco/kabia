# Merge report

`kabia-premium-opus` (design) + `kabia-website` (function) → `kabia-latest`.

Read `pre-merge-architecture.md` first — it documents the finding that the
backend lived in a git stash, which determined everything below.

## Strategy

Premium shell first: the target keeps the premium build configuration, design
system, homepage and Three.js work intact, and the recovered functional layer
was ported onto it with every visible surface rebuilt in the premium language.

Foundation: **Next 16.2.12, React 19.2.4, Tailwind v4, TypeScript strict, npm**.

## Brought from `kabia-premium-opus`

- `app/globals.css` design tokens, `app/layout.tsx`, fonts, metadata, JSON-LD.
- The entire homepage: `intro-sequence`, `almond-scene`, `almond-figure`,
  `kabia-transition`, `brand-manifesto`, `origin-story`, `process-story`,
  `principles`, `editorial-image`, `brand-quote`, `final-cta`,
  `product-collection`.
- `lib/intro-choreography.ts`, `lib/motion.ts`, `lib/site.ts`,
  `content/homepage.ts`, `components/motion/reveal.tsx`.
- `components/layout/site-header.tsx`, `site-footer.tsx`.
- All six orchard photographs and `logo.svg`, copied into `public/images/`.
- `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`.

## Preserved from `kabia-website`

Ported with logic unchanged unless noted:

- `lib/supabase/client.ts`, `lib/supabase/server.ts`.
- `lib/auth-context.tsx`, `cart-context.tsx`, `checkout-context.tsx`,
  `orders-context.tsx`, `favorites-context.tsx`, `cards-context.tsx`,
  `notification-prefs.ts`.
- `lib/catalog.ts` (queries + mappers), `lib/products.ts`, `lib/utils.ts`.
- `components/checkout/{types,validation,order-utils}.ts`,
  `components/cart/validation.ts`.
- Guest→account merge on login for cart, addresses, cards and favourites.
- Order creation through the `create_order` Postgres function.
- Every functional URL, and both Supabase auth callback URLs.
- The environment contract: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Anon key only; no service-role key anywhere.

### Backend changes, and why each was needed

| Change | Reason |
| --- | --- |
| `SupabaseClient` return type pinned on both clients | `createBrowserClient`'s `Database = any` default collapsed the schema generic and made every `auth.*` result implicitly `any`, which `ignoreBuildErrors` had been hiding. Smallest fix that restores typing without inventing a schema. |
| New `lib/supabase/rows.ts` | Row interfaces for the tables actually queried, replacing 20+ `any` mappers. The source had no generated types. |
| `ProfileRow` type + profile keyed by user id in `auth-context` | Removes an `any`, and lets a sign-out drop the profile by derivation instead of an effect. |
| `stock` added to `ProductVariant`, `stock_quantity` added to the select | `product_variants.stock_quantity` existed but was never mapped, so out-of-stock state could not be shown. Required by the brief's stock states. |
| `toCategory()` validates category slugs | Previously `any` let an unknown slug through and silently broke filtering. |
| Drawer state (`isOpen`/`openCart`/`closeCart`/`lastAdded`) removed from `cart-context` | The cart drawer was dropped in favour of one cart surface; leaving the API would have left dead handlers. |
| `localStorage` reads moved to lazy initialisers in `checkout-context` | Required by React 19's `set-state-in-effect` rule; also removes a render pass. Behaviour identical. |

No query, policy, authorization check or database identifier was altered.

## Frontend rebuilt in the premium language

`/shop`, `/shop/[slug]`, `/sepet`, `/odeme` (payment/review/confirmation),
`/giris`, `/kayit`, all seven `/hesabim` screens, `/blog`, `not-found`,
`error`, and the loading and empty states for each. New shared primitives:
`ui/button`, `ui/field`, `ui/switch`, `ui/theme-toggle`,
`layout/page-shell`, `auth/auth-shell`, `cart/order-summary`,
`account/order-status`, `shop/product-entry`.

Nothing from the pre-merge `kabia-website` presentation survives.

## Data integration

- Homepage ledger → featured products, falling back to the first active
  products, with real prices and links to `/shop/[slug]`.
- Shop index → `fetchProducts`, filtered and sorted on the server from URL
  search params (the source filtered client-side after a `useEffect` fetch;
  moving it server-side keeps the same contract and removes a client round trip).
- Product page → `fetchProductBySlug` + `fetchRelatedProducts` on the server.
- Header → live cart count and session state.
- Account → live orders, addresses, cards, favourites, preferences.

No hardcoded product data remains anywhere.

## Design system

One token layer in `app/globals.css`. One font pair. One button system. One
container (`.wrap`). Tokens split into a fixed brand palette (`forest`,
`cream`, `on-brand`) and themed tokens (`ivory`, `paper`, `ink`, `olive`,
`brand`, `shell`, `clay`) that flip for dark mode, so utilities such as
`bg-ivory` and `border-ink/10` follow the theme with no `dark:` variants in
markup. `--radius-media: 5px` corners every photographic surface.

## Post-merge changes requested during review

1. **Full dark mode.** `lib/theme.tsx` (system / light / dark, persisted),
   a pre-paint init script in `app/layout.tsx` so there is no flash, and a
   header toggle. `suppressHydrationWarning` is set on `<html>` only — the
   theme attribute is deliberately absent from server HTML because the server
   cannot know a `localStorage` value; the flag is scoped to that element's
   attributes and covers nothing inside it.
2. **Header** is now Mağaza · Çiftlik · Yaklaşım · İletişim, then theme, cart
   and profile icons.
3. **Order thumbnails** are circular and overlap into a stack, with a `+n`
   chip past four items.
4. **Account overview** shows "Son baktıklarınız" instead of the quick-link
   list, backed by `lib/recently-viewed.ts` (device-local slugs via
   `useSyncExternalStore`, resolved against the live catalogue).
5. Hero address line and scroll hint removed.

## Dependencies

Added: `@supabase/ssr`, `@supabase/supabase-js`, `clsx`, `tailwind-merge`,
`sonner`.

Kept from premium: `next`, `react`, `react-dom`, `three`, `@react-three/fiber`,
`@react-three/drei`, `framer-motion`, `lucide-react`, `tailwindcss` v4,
`typescript`, `eslint`, `eslint-config-next`, `@types/*`.

Dropped from website: all 27 `@radix-ui/*` packages, `tailwindcss-animate`,
`class-variance-authority`, `next-themes`, `recharts`, `embla-carousel-react`,
`cmdk`, `vaul`, `input-otp`, `react-day-picker`, `date-fns`, `react-hook-form`,
`@hookform/resolvers`, `zod`, `react-resizable-panels`,
`@emotion/is-prop-valid`, `autoprefixer`, `git`, `pnpm-lock.yaml`,
`components.json`, `tailwind.config.js`.

Dark mode uses the project's own token layer rather than `next-themes`; forms
use the project's own field primitives rather than `react-hook-form` + `zod`,
since the source project's validation was already hand-written and preserved.

One package manager, one lockfile: **npm**, `package-lock.json`.

## Removed

Old marketing components (`navbar`, `footer`, `product-card`, `about-section`,
`why-choose-us`, `video-section`, `testimonial-*`, `scroll-*`, `text-reveal`,
`parallax-effect`, `circular-text-button`, `category-slider`, …), the entire
`components/ui` shadcn set, `theme-provider`/`theme-toggle` from `next-themes`,
`styles/globals.css`, the `pp/` and `kabia-ekolojik-main/` stray directories,
the placeholder images, the `/magaza` placeholder page, the cart drawer, the
static product list in `content/homepage.ts`, and an unused `dark` button
variant.

The "Fatura İndir" button was dropped rather than ported: it only raised a
"preparing…" toast with no invoice behind it.

## Verification

Run from `/Users/mustafa/kabia-latest`:

| Command | Result |
| --- | --- |
| `npm install` | 429 packages, 0 errors |
| `npm run lint` | exit 0, clean |
| `npm run typecheck` | exit 0, clean |
| `npm run build` | succeeds, 17 routes |
| `npm test` | 20/20 pass |

`tests/routes.test.js` boots the production server and covers route responses,
live product data, product detail, unknown-product 404, category filtering,
the homepage↔catalogue link, the three redirects, `lang="tr"`, exactly one
header and one footer per page, premium-fonts-only, deterministic theme
attribute, and no account data in a signed-out `/hesabim` payload.

Two defects were found by these tests and fixed: a segment-level
`app/shop/loading.tsx` was wrapping `/shop/[slug]` in a Suspense boundary,
which flushed the shell early and turned unknown-product responses into
streamed 200s while duplicating the header in the payload. The boundary was
moved inside the shop index around the grid only.

## Remaining limitations

- Seeded product imagery points at `picsum.photos`; real photography replaces
  it in the database, not in code. Both that host and the Supabase Storage
  host are allow-listed in `next.config.ts`.
- The account and checkout screens were verified by build, type, lint and
  route tests, and by reading the preserved logic — but not by driving a
  signed-in session, since that would have written to the live Supabase
  project. Creating a test account is the one step left to exercise them
  end to end.
- `create_order` is trusted as-is; its SQL was not reviewed or changed.
- No middleware, matching the source. RLS is the enforcement boundary.
- The `three` deprecation warning (`THREE.Clock` → `THREE.Timer`) comes from
  `@react-three/drei` internals and is pre-existing upstream.

## Source integrity

Both source projects were re-checked after the merge and are byte-for-byte at
their pre-merge state:

- `kabia-premium-opus` — `ba45383`, same three modified files, same deleted
  logo, same two untracked entries.
- `kabia-website` — `8648265`, same two untracked entries.

Nothing was committed, installed, formatted or built inside either. The backend
was recovered with `git archive`, a read-only operation. `kabia-latest`
contains no symlinks into either directory and builds and runs without them.
