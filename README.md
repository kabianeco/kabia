# Kabia Ekolojik

Storefront for Kabia Ekolojik — almonds grown without chemical fertiliser or
pesticide in Sabırlar, Geyve / Sakarya.

One application: the premium editorial frontend and its Three.js homepage, on
top of the working Supabase shop, cart, checkout and account system. See
`docs/merge-report.md` for how the two were merged.

## Stack

- Next.js 16.2.12 (App Router, Turbopack) · React 19.2.4 · TypeScript strict
- Tailwind CSS v4 — tokens in `app/globals.css`, no `tailwind.config`
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr`
- Three.js / `@react-three/fiber` / `drei` for the homepage almond
- Framer Motion · lucide-react · sonner
- npm, one lockfile

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon/publishable key |

Both are public by design and safe in the browser. **There is no service-role
key in this application and none should be added** — every read and write goes
through the anon key so Row Level Security stays the enforcement boundary.
`.env.local` is gitignored; `.env.example` holds names only.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # route smoke tests (run `npm run build` first)
```

`npm test` boots the production server on port 3399 and asserts real responses;
override with `SMOKE_PORT`.

## Architecture

```
app/          routes — server components by default
components/
  layout/     header, footer, page shell
  home/       the homepage sequence and Three.js scene
  shop/       product index entry, product detail
  cart/       cart rows, addresses, order summary
  checkout/   payment → review → confirmation
  account/    account nav, order status
  ui/         button, field, switch, theme toggle
lib/
  supabase/   browser + server clients, row types
  *-context   auth, cart, checkout, orders, favorites, cards
  catalog.ts  product queries and mappers
tests/        production-build route smoke tests
docs/         merge documentation
```

Data fetching is server-side wherever the page allows it; `"use client"` is
used only where interaction requires it. All providers are mounted once in
`components/providers.tsx`, so provider state never re-renders the homepage
scene.

### Design system

One token layer. Fixed brand colours (`forest`, `cream`, `on-brand`) plus
themed tokens (`ivory`, `paper`, `ink`, `olive`, `brand`, `shell`, `clay`)
that flip for dark mode — so `bg-ivory` and `text-ink` follow the theme with no
`dark:` variants in markup. Type is Instrument Sans with Instrument Serif for
emphasis and figures. Photographic surfaces use `rounded-media` (5px).

Dark mode follows the system by default and can be overridden from the header;
the choice persists in `localStorage` and is applied before first paint.

### Auth

Supabase email/password plus Google and Apple OAuth, with password reset and
email-change confirmation. Session lives in cookies via `@supabase/ssr`.
`/hesabim/*` and `/odeme` redirect signed-out visitors to `/giris?next=…`;
**RLS is what actually protects the data.**

### Shop

Products, variants, images, nutrition facts and reviews come from Postgres.
The catalogue is server-rendered; category and sort live in the URL. Carts and
addresses work for guests in `localStorage` and merge into the account on sign
in. Orders are created by the `create_order` Postgres function, so totals and
order numbers are never computed in the browser.

### Three.js

The homepage almond is a client component behind a scroll-driven choreography
(`lib/intro-choreography.ts`). It is not loaded on any other route, respects
`prefers-reduced-motion`, simplifies on small screens, and renders on a
transparent canvas so it sits on either theme surface.

## Deployment

Any Node host that runs `next build` / `next start`; Vercel needs no extra
configuration. Set both environment variables in the host. `next/image` is
allow-listed for the Supabase Storage host and for `picsum.photos`, which the
seeded catalogue still uses — remove that entry once real photography is in.

## Known limitations

- Seeded product images are `picsum.photos` placeholders; replace them in the
  database, not in code.
- Signed-in account and checkout screens have not been driven end to end
  against the live project — see `docs/merge-report.md`.
- No middleware, matching the pre-merge application.
