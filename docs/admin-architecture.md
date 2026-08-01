# Kabia Admin — Architecture

Written before any database change was applied, from a full read of the application in
`/Users/mustafa/kabia-latest` and a live inspection of the connected Supabase project.

---

## 1. Connected project (verified)

| | |
|---|---|
| Supabase project name | `kabia` |
| Project ref | `xlubpolwuseafpcienql` |
| Postgres | 17.6 |
| Region | ap-northeast-1 |

Verified by comparing the ref in `NEXT_PUBLIC_SUPABASE_URL` (`.env.local`) against
`list_projects` over MCP. They match, so mutations through MCP target the project this
application actually talks to. No secret values are reproduced in this repository.

---

## 2. Current application architecture

- **Next.js 16.2.12**, App Router, React 19.2.4, TypeScript 5, strict.
- **Tailwind v4**, CSS-first configuration — all design tokens live in `app/globals.css`
  under `@theme`. There is no `tailwind.config`.
- **Fonts**: `Instrument_Sans` + `Instrument_Serif` via `next/font/google`, bound to
  `--font-sans` / `--font-serif` in `app/layout.tsx`.
- **State**: a single client provider stack (`components/providers.tsx`) —
  Theme → Auth → Cart → Checkout → Orders → Favorites → Cards. Everything below
  `AuthProvider` reads the Supabase session from it.
- **Supabase clients**:
  - `lib/supabase/client.ts` — browser singleton, anon key only.
  - `lib/supabase/server.ts` — `createServerClient` bound to `next/headers` cookies, anon key.
  - No service-role client existed before this work.
- **No middleware/proxy file existed.** No route was protected on the server; `/hesabim`
  guards on the client only.
- **Data access**: `lib/catalog.ts` maps `products` rows (with nested variants, images,
  nutrition, reviews) to the frontend `Product` shape. Row shapes are hand-written in
  `lib/supabase/rows.ts` — there are no generated database types.
- **Validation**: hand-rolled per feature (`components/cart/validation.ts`,
  `components/checkout/validation.ts`). No schema library was present.
- **Tests**: `tests/routes.test.js` — `node --test` smoke tests that boot `next start`
  against the production build and assert real routes and real Supabase data.
- **Currency**: Turkish lira, `₺`, formatted in-page. Store language is Turkish throughout.

### Existing routes

`/`, `/shop`, `/shop/[slug]`, `/sepet`, `/odeme`, `/giris`, `/kayit`, `/blog`,
`/hesabim` (+ `bilgilerim`, `adreslerim`, `siparislerim`, `siparislerim/[orderId]`,
`favorilerim`, `kart-bilgilerim`, `bildirimler`).

---

## 3. Existing authentication flow

Supabase Auth, email + password, entirely through `lib/auth-context.tsx`:

- `signInWithPassword` / `signUp` from the **browser** client.
- Session persisted in cookies by `@supabase/ssr`; the server client reads them.
- On signup, the `on_auth_user_created` trigger runs `public.handle_new_user()`, which
  inserts a `profiles` row, a `notification_preferences` row and a `carts` row.
- Profile data lives in `public.profiles` (`id` FK → `auth.users.id`).

There is **no role concept anywhere** in the existing system — no `user_roles` table, no
`app_metadata` role claim, no admin flag on `profiles`.

---

## 4. Relevant database schema (as discovered)

All tables below are in `public` and **all have RLS enabled**.

| Table | Rows | Notes |
|---|---|---|
| `categories` | 5 | `slug` unique. `cig-badem`, `kavrulmus`, `badem-unu`, `badem-ezmesi`, `paketli-urunler` |
| `products` | 12 | `slug` unique, `base_price`, `original_price`, `main_image_url`, `is_active`, `is_featured`, rating aggregates, `created_at`. **No `updated_at`, no SEO fields, no stock** |
| `product_variants` | 25 | `product_id`, `label`, `price`, `stock_quantity` (≥0), `sku` (unique, **all NULL today**). **Stock lives here, not on `products`** |
| `product_images` | 48 | `image_url`, `sort_order`. **No alt text, no storage path** |
| `nutrition_facts` | 12 | PK is `product_id` |
| `reviews` | 36 | triggers recompute `products.rating_*` |
| `profiles` | 1 | `full_name`, `phone`, `birth_date`, `created_at` |
| `addresses`, `payment_methods`, `favorites`, `notification_preferences` | 1/0/1/1 | owner-scoped |
| `carts` / `cart_items` | 1 / 0 | one cart per user |
| `orders` | 3 | `order_number` unique (`KB-XXXXXXX`), `status` enum, `subtotal`, `shipping_cost`, `total`, `shipping_address` jsonb, `payment_method_snapshot` jsonb, `full_name`, `email` |
| `order_items` | 4 | full product snapshots + `line_total` |
| `order_status_history` | 3 | `order_id`, `status`, `changed_at` |

**Enum** `public.order_status`: `hazirlaniyor`, `kargoda`, `teslim_edildi`, `iptal_edildi`.

**Functions**: `create_order(...)` (SECURITY DEFINER, the checkout path),
`handle_new_user()`, `set_review_verification()`, `update_product_rating()`,
`touch_cart_updated_at()`, plus the platform's `rls_auto_enable()` event trigger — which
means **any new table in `public` gets RLS enabled automatically on creation**.

**Storage**: zero buckets exist. Product imagery currently points at
`https://picsum.photos/...` placeholders; `next.config.ts` already allow-lists both
picsum and the Supabase host for `next/image`.

**Remote migrations** (7) exist in `supabase_migrations.schema_migrations` but there was
**no `supabase/` directory in the repository** — the remote was ahead of the repo from
the start. Fixing that is part of this work.

---

## 5. Existing RLS policies (preserved verbatim)

Public read, `USING (true)`: `categories`, `product_variants`, `product_images`,
`nutrition_facts`, `reviews`.
Public read, `USING (is_active = true)`: `products`.

Owner-scoped (`user_id = auth.uid()`), full CRUD: `addresses`, `payment_methods`,
`favorites`, `notification_preferences`, `carts`, `cart_items` (via cart ownership),
`reviews` (write side).

Owner-scoped **SELECT only**: `orders`, `order_items`, `order_status_history`,
`profiles` (+ own UPDATE).

Consequences that shape the admin design:

- `orders` has **no UPDATE policy at all** — nobody can currently change an order status
  through PostgREST. The admin needs a new, admin-only UPDATE policy.
- `products` / `product_variants` / `product_images` have **no write policies at all**.
- Every policy is `TO public` with an `auth.uid()` predicate, so adding permissive
  admin policies alongside them cannot widen customer access — permissive policies OR
  together, and the existing ones stay exactly as they are.

---

## 6. Admin route structure

```
/admin/login                     public   — alias-aware sign-in
/admin/unauthorized              public   — signed in, but not an administrator
/admin/sifre-degistir            gated    — forced password change
/admin                           gated    — overview
/admin/products, /new, /[id]     gated
/admin/inventory                 gated
/admin/orders, /[id]             gated
/admin/customers, /[id]          gated
/admin/media                     gated
/admin/content                   gated
/admin/settings                  gated
/admin/administrators            super_admin only
/admin/audit-logs                gated (super_admin sees everything)
```

Implemented as `app/admin/` inside this same Next.js application — no second app, no
second auth system, no separate host.

---

## 7. Role and permission model

New enum `public.app_role`: `customer`, `admin`, `super_admin`.
New table `public.user_roles` — one row per user, `user_id` PK → `auth.users(id)`,
plus `is_active`, `must_change_password`, and created/updated audit columns.

Absence of a row means `customer`. Only rows with `is_active = true` grant access.

| Capability | admin | super_admin |
|---|---|---|
| Products, inventory, media, content | ✅ | ✅ |
| Orders (status, notes, tracking) | ✅ | ✅ |
| Customers (read) | ✅ | ✅ |
| Non-sensitive settings | ✅ | ✅ |
| Sensitive settings | ❌ | ✅ |
| Administrator list / create / role change / revoke | ❌ | ✅ |
| Audit logs | own actions only | everything |

Two invariants enforced in the database, not just the UI:

1. An `admin` can never grant or hold out `super_admin`.
2. The **last active `super_admin` cannot be demoted, deactivated or deleted** — enforced
   by a trigger, so it holds even against direct SQL.

---

## 8. Authorization helpers

`SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp`, `EXECUTE` revoked from
`PUBLIC` and `anon`, granted only to `authenticated` (and `service_role` where needed):

- `public.current_admin_role() → app_role` — the caller's active admin role, or NULL.
- `public.has_admin_role() → boolean`
- `public.is_super_admin() → boolean`
- `public.authorize_admin(required public.app_role) → boolean`

They are `SECURITY DEFINER` specifically so that RLS on `user_roles` cannot recurse when
a policy on another table asks "is this caller an admin?". They read only `user_roles`
and return a boolean or an enum — no row data escapes.

**JWT claims are deliberately not used for authorization.** Supabase `user_metadata` is
user-editable, and `app_metadata` claims are stale until a token refresh. The database is
the single source of truth for role, on every request.

---

## 9. Data-fetching strategy

- Default to **server components**. Every admin page is a server component that creates
  the cookie-bound Supabase client and queries with the administrator's own session, so
  **RLS is the enforcement layer for reads**, not application code.
- Lists are server-paginated and server-filtered via `searchParams` — no unbounded
  queries, no fetch-everything-and-filter-in-the-browser.
- Aggregations that cannot be expressed as a single PostgREST call (revenue over time,
  top products, dashboard counters) run as parameterised `SECURITY DEFINER` RPCs that
  re-check `has_admin_role()` in their own body, have a pinned `search_path`, have
  `EXECUTE` revoked from `PUBLIC`/`anon`, and return only aggregate columns.
- Day bucketing uses `Europe/Istanbul`, the store's real timezone.
- Client components are used only for interaction: filters, dialogs, forms, charts,
  mobile navigation, uploads.
- Admin pages are `force-dynamic` / `no-store`. Private administrative data is never
  placed in a shared cache.

---

## 10. Mutation strategy

Every mutation is a **server action** in a `"use server"` module. Each one, without
exception:

1. Re-derives the acting user from the session (`getUser()`), never from form input.
2. Re-derives that user's role from `user_roles`, never from the client.
3. Validates input with a Zod schema.
4. Re-reads the authoritative current values from the database before acting on them
   (current price, current stock, current order status, current role).
5. Writes through the administrator's own RLS-protected session wherever possible.
6. Writes an audit record with the **server-derived** administrator identity.
7. Calls `revalidatePath` for the affected public store routes, so catalogue edits show
   up on the public site without a redeploy.
8. Returns a safe, Turkish, user-facing message — raw Postgres errors are logged
   server-side and never returned to the browser.

The service-role client is used for exactly three things, all of which genuinely require
the Auth Admin API: creating the bootstrap administrator, creating/inviting an
administrator, and reading auth-only fields (`last_sign_in_at`, `email`) for the
administrator and customer screens. It lives in a `server-only` module.

---

## 11. Audit-log strategy

`public.admin_audit_logs`, append-only:

- Rows are written exclusively by `public.log_admin_action(...)`, a `SECURITY DEFINER`
  function that derives `admin_user_id` from `auth.uid()` and `admin_role` from
  `user_roles`. A client-supplied administrator id is structurally impossible.
- There is **no INSERT, UPDATE or DELETE policy** on the table, and a trigger raises on
  any UPDATE or DELETE — immutability survives a future policy mistake.
- SELECT: `super_admin` sees everything; `admin` sees only their own actions.
- Never stores passwords, tokens, keys or card data. `before_data`/`after_data` carry
  only the domain columns of the changed row.

Audited: product create/update/archive, variant changes, inventory adjustments,
order status changes and cancellation, order notes and tracking, settings changes,
media upload/delete, administrator create/role-change/deactivate, and the bootstrap
itself.

---

## 12. Security boundaries

| Layer | Mechanism |
|---|---|
| 1 — Session | `proxy.ts` scoped to `/admin/:path*`; no session → `/admin/login` |
| 2 — Role | `app/admin/(protected)/layout.tsx` server component; no admin role → `/admin/unauthorized` |
| 3 — Action | `requireAdmin()` / `requireSuperAdmin()` at the top of every server action |
| 4 — Database | RLS policies + `SECURITY DEFINER` functions that re-check the caller |

Layer 4 is the real boundary. Layers 1–3 exist so that unauthorised users get a correct
experience, not so that they get security.

Storage: the `product-media` bucket is publicly readable (product photos are public by
nature) and writable only where `public.has_admin_role()` is true.

---

## 13. Required migrations

1. Baseline: capture the 7 pre-existing remote migrations into `supabase/migrations/`.
2. `app_role` enum + `user_roles` + authorization helpers + the last-super-admin trigger.
3. `admin_audit_logs` + `log_admin_action()` + immutability trigger.
4. Admin RLS policies across catalogue, order, customer and storage tables.
5. Catalogue columns the dashboard needs: `products.updated_at` (+ touch trigger),
   `low_stock_threshold`, `seo_title`, `seo_description`, `display_order`;
   `product_images.alt_text`, `storage_path`.
6. `inventory_adjustments` + `admin_adjust_stock()` RPC.
7. Order operations: `orders.tracking_number`/`tracking_carrier`, `order_notes`,
   status-transition trigger, `admin_update_order_status()` RPC.
8. `site_settings` with a controlled key set, seeded from `lib/site.ts`.
9. Dashboard aggregation RPCs + supporting indexes (incl. `pg_trgm` for search).
10. `product-media` storage bucket + policies.

Every one of these is written as a versioned file in `supabase/migrations/` **first**,
then applied through MCP — never the other way round.

---

## 14. Admin login strategy

Supabase Auth has no username concept; password auth is keyed on email or phone. So
`admin` is an **application-level alias resolved only on the server**:

- The form field accepts either `admin` or a full email address.
- A server action compares the input against `ADMIN_BOOTSTRAP_USERNAME` (server-only) and,
  on a match, substitutes `ADMIN_BOOTSTRAP_EMAIL` (`admin@kabia.local`).
- There is no route handler, RPC or public endpoint that maps a username to an email, so
  the alias cannot be used to enumerate accounts.
- After a successful `signInWithPassword`, the action immediately checks `user_roles`.
  A non-administrator is signed straight back out and gets the same generic message as a
  wrong password: *"Kullanıcı adı veya şifre hatalı."*

`ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_EMAIL` are **not** `NEXT_PUBLIC_`, so the
alias never reaches the browser bundle.

---

## 15. Known schema limitations

These are properties of the existing system, recorded rather than papered over. None of
them are worked around with fabricated data.

1. **No payment status.** `orders` records a masked `payment_method_snapshot`
   (`cod` or `card`) but no paid/unpaid/failed state, and there is no payment provider
   integration. Revenue is therefore defined as **the total of all orders whose status is
   not `iptal_edildi`**, and this definition is stated in the UI. Cancelled orders are
   excluded everywhere.
2. **No refund capability.** There is no payment provider to refund through, so no refund
   action is offered. Cancelling an order sets `iptal_edildi` and nothing more.
3. **Checkout never decrements stock.** `create_order()` validates stock but does not
   subtract it. Cancellation therefore does not restock, and the inventory screen is the
   only thing that moves `stock_quantity`. This is pre-existing behaviour and is left
   alone — changing it would alter live checkout semantics, which is outside this task.
4. **Stock is per variant, not per product.** The inventory screen operates on variants;
   product-level stock figures are sums across variants.
5. **SKUs are all NULL.** The column exists and is unique; the dashboard shows and can
   set it, but no seeded product has one.
6. **No fulfilment state separate from order state.** The single `order_status` enum
   covers both, so the dashboard presents one status axis rather than inventing a second.
7. **`profiles` has no account-disabled flag.** Customer "account status" is derived from
   the auth user (`banned_until`, `email_confirmed_at`) read through the Auth Admin API.
8. **Product imagery is placeholder URLs.** A real `product-media` bucket is created and
   the media manager writes to it; existing picsum URLs are left in place rather than
   being fabricated over.
