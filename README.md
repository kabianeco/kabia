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

### Opening the dev server from another host

`next dev` serves Fast Refresh over a WebSocket at `/_next/webpack-hmr` and, by
default, only accepts that upgrade from `localhost`/`*.localhost`. `localhost`
and `127.0.0.1` work out of the box — `proxy.ts` canonicalises `127.0.0.1` to
`localhost` for document requests, so the HMR socket connects on the canonical
origin either way. To open the dev server from a phone or another machine — the
"Network" URL `next dev` prints on startup — list that host in Next's own
`allowedDevOrigins` config (see the [Next.js docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins))
if you need it; this project does not configure it.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # route smoke tests + theme-engine unit tests (run `npm run build` first)

npm run test:dev-stability          # boots `next dev` (Turbopack) and asserts it does not loop
npm run test:dev-stability:webpack  # the same suite against `next dev --webpack`
npm run test:affected-routes        # /magaza + /admin/appearance against the production build

npm run test:role-revocation   # needs .env.local + a running server
# Theme-engine DB-backed tests (auth/publish/revisions):
node --test --conditions=react-server --import ./tests/alias-hook.mjs --env-file=.env.local tests/theme-engine-auth.test.ts
```

`npm test` boots the production server on port 3399 and asserts real responses;
override with `SMOKE_PORT`.

`npm run test:dev-stability` starts its own `next dev`, so stop any running
`npm run dev` first — Next allows one dev server per project directory. It
drives the server over `127.0.0.1` on purpose: that is the origin the reload
loop reproduced on, and `localhost` alone would never have caught it. It asserts
the HMR socket connects, that the dev server logs no blocked cross-origin
request, that `/magaza` and `/admin/appearance` each answer one document on
direct entry and on hard refresh, that both tabs sit still for longer than a
full reload cycle, and that editing a rendered component is one Fast Refresh
rather than a document reload.

`npm run test:role-revocation` is separate because it needs Supabase credentials
and a live server. It creates two throwaway accounts, has a super admin revoke
the other's admin role, and asserts the denial is one stable redirect with no
loop — then deletes both accounts. It skips cleanly when either prerequisite is
missing.

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

**Controlled appearance engine** — authorized administrators can reshape the
public design from `/admin/appearance` (nav: **Görünüm**): three shape presets
(Keskin / Dengeli / Yumuşak), an approved font allowlist (4 body + 4
editorial, loaded statically via `next/font`), typography profiles, and
constrained fine-tuning of radii, borders, shadows, icons and density.
Changes save as a draft and publish atomically; the storefront reads the
published theme during SSR (no flash). Colors stay fixed in this phase.
Three.js, full-bleed sections, circular avatars/dots and the admin shell are
intentionally not reshaped. Docs:
`docs/theme-engine-architecture.md`, `docs/theme-engine-database-changes.md`,
`docs/theme-engine-operations.md`.

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

- Seeded product images are `picsum.photos` placeholders. Replace them from
  **Yönetim → Medya**: upload, then pick them on the product with *Medyadan seç*.
  They are deliberately still supported, so historical products keep working.
- Signed-in account and checkout screens have not been driven end to end
  against the live project — see `docs/merge-report.md`.
- A revoked administrator's already-open page keeps showing what it rendered
  until they navigate; nothing polls authorization. Their next request is denied.
- Images uploaded directly through the Supabase dashboard bypass the app and do
  not appear in the media library.

## Admin dashboard

`proxy.ts` guards `/admin/*` for session presence only; roles are re-read from
the database on every request by `lib/admin/auth.ts`, never taken from a JWT
claim. In development it also canonicalises `127.0.0.1` to `localhost` so the
HMR WebSocket is never refused on a non-canonical origin. Media lives in the

- `docs/admin-media-architecture.md` — media library and the authorization model
- `docs/admin-media-database-changes.md` — schema, RLS and Storage policies
- `docs/admin-operations.md` — operator procedures
- `docs/admin-architecture.md` — the wider dashboard
