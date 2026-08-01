# Pre-merge architecture

State of both source projects as inspected before any code was written, and the
merge strategy chosen off the back of it.

## Source snapshots

| Project | Path | HEAD | Working tree at inspection |
| --- | --- | --- | --- |
| Premium frontend | `~/Desktop/kabia-premium-opus` | `ba45383` | `M app/layout.tsx`, `M components/layout/site-footer.tsx`, `M components/layout/site-header.tsx`, `D public/images/kabia-logo.png`, `?? .playwright-mcp/`, `?? public/images/logo.svg` |
| Functional app | `~/kabia-website` | `8648265` | `?? .DS_Store`, `?? homepage-design-audit.md` |

Neither project was modified. Both were re-checked after the merge and match
these baselines exactly.

## The finding that shaped everything

`kabia-website`'s **working tree contains no backend at all**. It is a
v0.dev-generated static marketing site: Next 15.2.4, Tailwind v3, shadcn/ui, a
`/shop` page that is a "coming soon" newsletter placeholder, and no Supabase
code, auth, cart, checkout, middleware, API route or server action anywhere.
Its `.env.local` holds Supabase credentials that nothing reads.

The real commerce and authentication implementation exists only inside that
repository's **git stash**, specifically the untracked-files commit
`refs/stash^3` (`stash@{0}`, "On main: pre-redesign state"). Stashing with
untracked files removed those files from disk, which is why they are invisible
in the checkout.

It was recovered read-only with `git archive refs/stash | tar -x` overlaid with
`git archive refs/stash^3`, reconstituting the full pre-stash working state
(165 files) in a scratch directory. That reconstructed state is the authority
for everything backend in this merge. The stash's tracked diff also carries the
two dependencies the code needs: `@supabase/ssr` and `@supabase/supabase-js`.

The Supabase project behind it is live and seeded — products, categories,
variants, images, nutrition facts and reviews all return rows to the anon key,
while `carts`, `orders`, `addresses`, `payment_methods` and
`notification_preferences` correctly return nothing without a session, which
confirms RLS is active.

## What each project owned

### `kabia-premium-opus` (frontend)

- Next 16.2.12, React 19.2.4, Tailwind v4 (`@theme` in `app/globals.css`).
- Instrument Sans + Instrument Serif via `next/font/google`.
- Palette: ivory `#f4f1e8`, paper `#eae5d8`, ink `#1c201b`, forest `#0b3f2c`,
  brand `#147b4b`, shell `#c29a63`, cream `#e8d5aa`, olive `#77806f`.
- Homepage: a four-act scroll intro (`intro-sequence.tsx`, 619 lines) driving a
  Three.js almond (`almond-scene.tsx`, 756 lines) through
  `lib/intro-choreography.ts`, then manifesto, product ledger, origin story,
  process story, principles, editorial plate, quote and contact CTA.
- `components/layout/site-header.tsx` / `site-footer.tsx`, a `Reveal`
  entrance primitive, a `MotionConfig` boundary, and `lib/motion.ts` tokens.
- Six orchard photographs in `public/images/` plus `logo.svg`.
- A `/magaza` page that was a placeholder — no store behind it.

### `kabia-website` (function, via the stash)

- Routes: `/shop`, `/shop/[slug]`, `/sepet`, `/odeme`, `/giris`, `/kayit`,
  `/hesabim` + six sub-pages, `/farm`, `/contact`, `/blog`.
- `lib/supabase/client.ts` (browser, anon key, singleton) and
  `lib/supabase/server.ts` (`createServerClient` over `next/headers` cookies).
- Six React contexts: auth, cart, checkout, orders, favorites, cards, plus a
  `useNotificationPrefs` hook. Each reads the session from auth and either hits
  Postgres or falls back to guest `localStorage`, merging guest state on login.
- `lib/catalog.ts` — row → `Product` mappers and the product queries.
- Order creation via the `create_order` Postgres function (totals and order
  number are produced server-side, not in the browser).
- No middleware, no API routes, no server actions, no generated database types,
  no tests. `next.config.mjs` set `eslint.ignoreDuringBuilds` and
  `typescript.ignoreBuildErrors`.

## Conflicts and resolutions

| Conflict | Resolution |
| --- | --- |
| Two Next majors (16.2.12 vs 15.2.4) | Took **16.2.12**. The premium homepage — the most fragile artifact in the merge — was authored and verified against it, while the backend is version-agnostic and already used Next 15+ async `params`/`cookies()`. A deliberate upgrade, not a casual one. |
| Two Tailwind majors (v4 `@theme` vs v3 config + shadcn CSS vars) | Took **v4**. The premium design system *is* the `@theme` block; keeping v3 would mean rewriting it. `tailwind.config.js` and the shadcn variable layer were dropped. |
| Two UI kits | Neither survives wholesale. The shadcn/Radix layer was dropped and a small premium primitive set was written (`button`, `field`, `switch`, `theme-toggle`); every commerce and auth screen was rebuilt against it. |
| Two store URLs (`/magaza` vs `/shop`) | `/shop` wins — it is the shipped functional URL. `/magaza` became a 308 redirect. |
| `ignoreBuildErrors` / `ignoreDuringBuilds` | Not carried over. The errors they were hiding were fixed instead (see the merge report). |
| Cart drawer vs cart page | One cart surface at `/sepet`; the drawer was dropped and its now-dead context API removed. |
| Homepage product ledger was static "coming soon" copy | Rewired to the live catalogue. |

## Merge strategy

The target was assembled premium-shell-first rather than by copying
`kabia-website` wholesale and stripping it: the premium project supplies the
build configuration, design system, homepage and Three.js work intact, and the
recovered functional layer (`lib/**`, route structure, business logic) was
ported onto it with its UI rebuilt in the premium language. The result is the
same as the sequence the brief describes — every functional contract preserved,
every visible surface premium — without carrying a Tailwind v3 + shadcn layer
through the middle of it.
