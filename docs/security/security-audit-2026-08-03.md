# Kabia Security Audit

**Audit date:** 2026-08-03
**Repository:** `/Users/mustafa/kabia-latest`
**Branch / commit:** `main` @ `9a13e1d74f917572b324a08a12ed3ee3047b61df` ("Sync full project state to kabia repo")
**Working tree state at start:** clean (`git status` reported nothing to commit).
**Auditor model:** opencode-go/glm-5.2 (read-only autonomous review).
**Scope of change made by this audit:** only this report file (`docs/security/security-audit-2026-08-03.md`) was created. No application code, configuration, migrations, RLS, grants, Storage policies, env, or production data was altered. No commit was made.

---

## Executive Summary

A complete read-only security audit was performed across the Next.js storefront,
the `/admin` dashboard, the Supabase schema/RLS/RPC layer, Storage and upload
paths, the blog and rich-text pipeline, the theme/preview system, the checkout
and order flows, dependency manifest, and the connected Supabase project
(`xlubpolwuseafpcienql`) in read-only mode.

The codebase demonstrates a deliberately security-conscious architecture:

- The admin authorization decision is centralized in `lib/admin/access.ts` and
  `lib/admin/auth.ts`. Every page and every Server Action re-derives the acting
  administrator from `auth.getUser()` plus a fresh `user_roles` read on each
  request; nothing trusts a client-supplied identity, role, actor id, price,
  inventory count, or order ownership.
- The database is the final authorization boundary. RLS is enabled on every
  public-facing table; admin-only writes are gated on `public.has_admin_role()`
  / `public.is_super_admin()`; the audit trail is append-only via a `BEFORE
  UPDATE/DELETE` trigger; the last-super-admin invariant is enforced by a
  trigger that holds against direct SQL.
- All administrator mutations (logs, inventory, order status, theme
  publish/restore, administrator create/role-change) flow through
  `SECURITY DEFINER` RPCs that re-derive the actor from `auth.uid()` and pin
  `search_path`. No client argument ever supplies an actor id to the audit
  writer.
- The blog rich-text renderer allowlists node/mark types and link protocols at
  save time and re-validates at render time. There is no `dangerouslySetInnerHTML`
  in the blog renderer.
- Theme CSS variables are produced from a closed, enumerated vocabulary; the
  preview / draft preview flows use short-lived, subject-bound, constant-time
  HMAC tokens scoped to individual cookie paths.
- Media uploads byte-probe the four accepted image containers (no SVG),
  rebuild the storage path from a slugified stem + random UUID + probed
  extension, and persist rows through the acting admin's RLS-protected session.

**No exploitable authentication-bypass, authorization-bypass, IDOR, RLS bypass,
stored XSS, theme CSS injection, preview-token forgery, open-redirect, SQL
injection, or path-traversal vulnerability was discovered in the application
code.**

The audit identified one **confirmed supply-chain finding** (transitive
dependency vulnerabilities with bounded but real reachability), several
**deferred / unconfirmed concerns** that could not be fully validated without
production credentials or platform configuration access, and a set of
**hardening opportunities** (defense-in-depth improvements without a
demonstrated exploitable path).

| ID | Severity | Finding | Affected Surface | Confidence |
| -- | -------- | ------- | ---------------- | ---------- |
| KABIA-SEC-001 | Medium | Vulnerable transitive dependencies (`postcss`, `sharp`) bundled inside `next@16.2.12` | Dependency tree (build-time CSS pipeline; next/image optimizer) | High |
| KABIA-SEC-002 | Low (deferred) | No application-level rate limiting / lockout on auth endpoints | `/api/auth`, `/admin/login`, `/giris`, `/kayit`, password-reset path | Medium |
| KABIA-SEC-003 | Low (deferred) | `site_settings` script-check regex does not block the `data:` protocol in admin-set URL strings | `public.site_settings` (`shop_banner_cta_href` etc.); `app/shop/page.tsx`, `components/shop/shop-hero-banner.tsx:54-61` | Medium |
| KABIA-SEC-004 | Low (hardening) | Leaked Password Protection is disabled on the Supabase Auth project | Supabase Auth project settings (`xlubpolwuseafpcienql`) | High |
| KABIA-SEC-005 | Low (hardening) | Order status transition trigger fully relaxed (any → any) for administrators | `supabase/migrations/20260801003000_relax_order_status_transition.sql:11-24` | High |
| KABIA-SEC-006 | Low (hardening) | No explicit `Content-Security-Policy` or hardened security headers in `next.config.ts` | `next.config.ts:1-32` (deployment-wide) | High |
| KABIA-SEC-007 | Informational (hardening) | `SECURITY DEFINER` RPCs grant `EXECUTE` to `authenticated`/`anon` (advisor-flagged, intentional design) | All `public.admin_*`, `public.current_admin_role()`, `public.has_admin_role()`, `public.is_super_admin()`, `public.authorize_admin`, `public.save_site_theme_draft`, `public.publish_site_theme`, `public.restore_site_theme_version`, `public.discard_site_theme_draft`, `public.get_published_site_theme`, `public.setting_number`, `public.setting_bool`, `public.log_admin_action` | High |

The severity levels reflect reachability, required privileges, data
sensitivity, blast radius, exploit complexity, and existing mitigations per the
rubric in the audit brief. No severity was inflated; the confirmed supply-chain
finding is rated **Medium** rather than **High** because the vulnerable code
paths (CSS build pipeline and next/image optimizer) are reachable only
indirectly and require attacker-controlled CSS or a malicious image to reach a
vulnerable parsing step.

---

## Scope

In scope:

- The full repository tree at commit `9a13e1d74f917572b324a08a12ed3ee3047b61df`.
- Next.js 16 App Router architecture: Server Components, Client Components,
  route handlers, Server Actions, `proxy.ts` (formerly `middleware.ts`).
- Public routes (`/`, `/shop`, `/shop/[slug]`, `/magaza`, `/blog`, `/blog/[slug]`,
  `/blog/rss.xml`, `/sepet`, `/odeme`) and account routes
  (`/hesabim/**`, `/giris`, `/kayit`).
- Admin routes (`/admin/login`, `/admin/unauthorized`, `/admin/sifre-degistir`,
  `/admin/(protected)/**` including products, orders, customers, inventory,
  administrators, audit-logs, appearance + preview, content, settings, search,
  categories, blog + preview, media + media API).
- Supabase schema, RLS, RPC functions, `SECURITY DEFINER` functions, grants,
  triggers, Storage bucket and Storage policies.
- Supabase Auth project configuration (read via Supabase MCP advisors).
- Theme engine, theme preview system, blog engine and rich-text renderer.
- Media upload pipeline, Storage public-URL handling.
- Dependency manifest, lockfile-driven transitive resolution, npm scripts.

Out of scope (not exercised):

- Active exploitation, destructive testing, or any mutating operation against
  the remote Supabase project.
- Network-level / hosting-platform configuration outside the repository (Vercel
  project settings, CDN, WAF, edge function configuration, SMTP provider,
  OAuth provider consoles for Google/Apple).
- Customer emails, password reset link delivery, or third-party analytics.
- Penetration testing of live infrastructure.

---

## Methodology

1. Recorded git state (branch `main`, commit `9a13e1d`, clean working tree).
2. Built a complete inventory of: TypeScript files in `app/`, `lib/`,
   `components/`; Supabase migrations; npm scripts; environment template.
3. Read every security-relevant file: the proxy (`proxy.ts`), the admin
   authorization decision module (`lib/admin/access.ts`), the server-side
   admin guards (`lib/admin/auth.ts`), all admin Server Actions
   (`app/admin/(protected)/**/actions.ts`, `app/admin/login/actions.ts`,
   `app/admin/sifre-degistir/actions.ts`), all admin pages, the protected
   layout, the Supabase server/clients (`lib/supabase/*`), and the Supabase
   admin client that wraps the service-role key.
4. Read all 29 migration files under `supabase/migrations/` to enumerate RLS
   policies, grants, `SECURITY DEFINER` functions, triggers, and Storage
   policies.
5. Traced sensitive flows from user-controlled input to authorization decision,
   database mutation, Storage operation, HTML rendering, redirect, and
   external request: admin login, customer login/registration, checkout,
   customer order detail, administrator create / role-change / deactivate,
   product save, inventory adjustment, order status change, media upload /
   delete, theme draft / publish / restore, blog save / publish / schedule /
   archive / delete, blog preview, appearance preview.
6. Inspected the connected Supabase project read-only via Supabase MCP:
   - `supabase_list_projects` → confirmed `xlubpolwuseafpcienql` (region
     `ap-northeast-1`, Postgres 17.6.1.155).
   - `supabase_get_advisors(type=security)` → full security advisor output is
     summarized in the **Supabase Security Review** section.
7. Ran applicable non-mutating checks:
   - Dependency audit: `npm audit --json` (output captured; advisories
     summarized in the **Dependency and Supply-Chain Review** section).
   - Static searching for unsafe APIs: `grep` for
     `eval(`/`new Function(`/`child_process`, `dangerouslySetInnerHTML`,
     `Content-Security-Policy`, `headers()`, `SUPABASE_SERVICE_ROLE_KEY` usage,
     tracked secret files.
   - Type checking: `npm run typecheck` → exit `0` (clean).
   - Linting: `npm run lint` → exit `0`; 4 stylistic lint errors
     (`react-hooks/set-state-in-effect`) and 2 unused-import warnings. None
     of these are security findings; they are reported in the
     **Test and Tool Results** section.
   - Unit tests: `npm test` → 234 tests / 59 suites / 0 failures (incl. the
     `tests/admin-authorization.test.ts`, `tests/blog-content.test.ts`,
     `tests/blog-preview-cookie.test.ts`, `tests/theme-preview-cookie.test.ts`,
     and `tests/role-revocation.test.js` suites that directly exercise the
     security-relevant allowlists and HMAC tokens).
8. Validated each candidate finding: every potential issue reviewed for
   reachability, required privileges, and existing compensating controls
   before being classified.
9. Distinguished confirmed vulnerabilities from unconfirmed concerns,
   hardening opportunities, and rejected candidates (see
   **Required Distinctions** below).
10. No destructive exploitation was performed; no production record was read
    or modified beyond what the platform advisor output already returned
    (which contains only advisory metadata, no customer data).

Temporary scan output was kept only in the shell session; no files outside the
repository were written.

---

## Architecture and Trust Boundaries

### Layered architecture

1. **Edge/proxy layer** — `proxy.ts` (Next.js 16 proxy, formerly
   `middleware.ts`) runs on every non-static-asset, non-HMR-WebSocket request
   (`proxy.ts:152-156`). For `/admin/**` routes only, it runs
   `adminSessionSync` (`proxy.ts:69-127`), which creates a server-side Supabase
   client with the public anon key, calls `getUser()`, and redirects
   unauthenticated visitors to `/admin/login`. It uses
   `classifyAuthError` (`lib/admin/access.ts:76-95`) to distinguish
   "unauthenticated" from "unavailable" — a transient Supabase failure never
   becomes a confident "you are not signed in" decision (which is what
   previously caused infinite `/admin ⇄ /admin/login` loops). Every admin
   response is stamped `x-kabia-admin-guard: 1` so the guard is observable
   from outside.

2. **Protected layout** — `app/admin/(protected)/layout.tsx:112-146` calls
   `guardOutcome(await resolveAdminAccess())` on every document request.
   `unavailable` is rendered as a stable error screen with no navigation;
   `unauthenticated` → `/admin/login`; `unauthorized` → `/admin/unauthorized`;
   admin with `mustChangePassword` → `/admin/sifre-degistir`; admin with
   insufficient permission → `/admin/unauthorized`; otherwise render.
   `dynamic = "force-dynamic"`, `revalidate = 0` — admin data is never cached.

3. **Page-level guard** — every page under `(protected)` independently calls
   `requireAdminPage()` or `adminPageContext(permission)` from
   `lib/admin/auth.ts:101-157`. The comment in `layout.tsx:25-32` documents
   explicitly why this is necessary: on a soft navigation between two routes
   in the same layout group, Next.js reuses the already-rendered layout from
   the client router cache, so a layout-only guard never re-runs. The page
   guard shares the same request-scoped verdict via React `cache()`
   (`lib/admin/auth.ts:49`), so layout and page cannot drift apart and the
   extra calls cost nothing within one request.

4. **Server Action guard** — every `"use server"` file calls
   `requireAdmin()`, `requirePermission(permission)`, `requireSuperAdmin()`,
   or `adminContext(permission)` before doing anything
   (`lib/admin/auth.ts:101-173`). On failure it throws `AdminAuthError`/
   `AdminAuthUnavailableError`; the action's `try { … } catch { toActionState
   }` (`lib/admin/errors.ts:92-113`) converts that to a user-safe, Turkish
   message that never leaks Postgres/Supabase internals.

5. **Database boundary** — RLS on every public-facing table; admin-only
   writes gated on `public.has_admin_role()` / `public.is_super_admin()`;
   the only writes to append-only tables (`admin_audit_logs`,
   `inventory_adjustments`, `site_theme_revisions`) go through
   `SECURITY DEFINER` RPCs that re-derive the actor from `auth.uid()` and
   the database-backed role. The audit-log writer has no `adminUserId`
   parameter (`lib/admin/audit.ts:1-17`); a client-supplied actor id is
   structurally impossible.

6. **Client layer** — the browser Supabase client
   (`lib/supabase/client.ts:1-21`) is a singleton built with the **anon
   publishable key only**. The service-role key is read by
   `lib/supabase/admin.ts:1-54`, which carries `import "server-only"` so any
   client-component import is a build error; the secret cannot reach a
   browser bundle.

### Trust boundaries

| Boundary | Enforced by |
| --- | --- |
| Anonymous vs. authenticated | Supabase Auth + cookie-bound server client (`lib/supabase/server.ts`) |
| Customer vs. administrator | `user_roles` row + `is_active = true` + role in `('admin','super_admin')`, read fresh each request (`lib/admin/auth.ts:49-82`) |
| `admin` vs. `super_admin` | `public.is_super_admin()` in RPC bodies and RLS policies (`supabase/migrations/20260801000100…:197-200`; `20260801004000…:131-133`) |
| Dashboard vs. database | Every admin write runs through the acting admin's own RLS-protected session (`lib/admin/auth.ts:160-173`); the service-role client is used only for Auth Admin API operations that genuinely require it |
| Public vs. draft (blog/theme) | Public surfaces query explicit eligibility predicates; drafts are reachable only via signed, post-bound/admin-bound, scoped, short-lived cookies (`lib/blog/preview-cookie.ts`, `lib/theme-engine/preview-cookie.ts`) |

### Hydration / cache safety

- The auth context (`lib/auth-context.tsx:53-103`) stores the loaded profile
  keyed by `userId`; switching accounts or signing out drops the profile by
  derivation rather than relying on an effect to clear it.
- The orders context (`lib/orders-context.tsx:101-114, 124-136`) **explicitly**
  filters `refresh()` and `fetchOrder()` on `user_id = userId`, even though
  RLS would scope it. A signed-in administrator visiting their own account
  page therefore does not receive the order book on the account screen
  (`orders-context.tsx:105-107` comment).
- The published-theme reader (`lib/theme-settings.ts:103-131`) caches only
  validated results via `unstable_cache` with a 5-minute ceiling and the
  `SITE_THEME_TAG` tag. Failures throw inside the cached function and never
  persist a null theme as an authoritative value.
- The published-settings reader (`lib/settings.ts:117-150`) uses an anonymous
  client (no session-bound cookies) so the result is shared across every
  visitor; RLS `settings_public_read` returns only `is_public` rows.
- Every admin page sets `dynamic = "force-dynamic"` and `revalidate = 0`;
  `adminPageContext` returns the admin's cookie-bound client, so requests
  are not shared across users.

---

## Attack Surface Inventory

### Public routes

| Route | Method | File | Surface |
| --- | --- | --- | --- |
| `/` | GET | `app/page.tsx` | Home with featured products, settings-driven hero/footer |
| `/shop`, `/magaza` | GET | `app/shop/page.tsx`, `app/magaza/page.tsx` | Product catalogue + shop hero banner (admin-set) |
| `/shop/[slug]` | GET | `app/shop/[slug]/page.tsx` | Product detail (active products only via RLS `products_public_read`) |
| `/blog` | GET | `app/blog/page.tsx` | Public blog list (published or scheduled and past `published_at`) |
| `/blog/[slug]` | GET | `app/blog/[slug]/page.tsx` | Public blog post + slug-redirect resolution via `blog_slug_history` (eligible posts only) |
| `/blog/rss.xml` | GET | `app/blog/rss.xml/route.ts` | RSS feed of latest 50 eligible posts (XML-escaped) |
| `/sepet` | GET | `app/sepet/page.tsx` | Cart (client; uses customer RLS if logged in, localStorage if guest) |
| `/odeme` | GET | `app/odeme/page.tsx` | Checkout flow (client; gated client-side; `create_order` RPC checks `auth.uid()`) |
| `/giris` | GET | `app/giris/page.tsx` | Customer sign-in |
| `/kayit` | GET | `app/kayit/page.tsx` | Customer sign-up |
| `/hesabim/**` | GET | `app/hesabim/layout.tsx` + `app/hesabim/**` | Account area (client guard + RLS) |
| `/sitemap.xml` | GET | `app/sitemap.ts` | Sitemap |
| `next/image` optimized images | GET | `next.config.ts:7-19` | `picsum.photos`, `fastly.picsum.photos`, the project's own Supabase storage host |

### Auth-only routes (Sign-in, Sign-out, Password change)

| Route | Method | File | Surface |
| --- | --- | --- | --- |
| `/admin/login` | GET | `app/admin/login/page.tsx` + `login-form.tsx` | Admin sign-in form |
| `adminLoginAction` | Server Action | `app/admin/login/actions.ts:32-79` | Resolves `admin` alias server-side, validates role post-auth, signs out customers, validates `next` against strict admin-path regex |
| `adminSignOutAction` | Server Action | `app/admin/login/actions.ts:81-85` | Sign-out + redirect to login |
| `/admin/sifre-degistir` | GET | `app/admin/sifre-degistir/page.tsx` | Forced/voluntary password rotation screen (own guard; outside `(protected)` group to avoid loop) |
| `changeAdminPasswordAction` | Server Action | `app/admin/sifre-degistir/actions.ts:16-68` | Validates stricter-Than-Supabase policy, `auth.updateUser`, then `admin_complete_password_change` RPC |
| `/admin/unauthorized` | GET | `app/admin/unauthorized/page.tsx` | Static "access denied" page |

### Admin protected routes

| Route | Permission (server) | File |
| --- | --- | --- |
| `/admin` | `requireAdminPage()` (any admin) | `app/admin/(protected)/page.tsx:65` |
| `/admin/products` | `manageCatalogue` (admin+super) | `app/admin/(protected)/products/page.tsx:40` |
| `/admin/products/new` | `manageCatalogue` | `app/admin/(protected)/products/new/page.tsx:11` |
| `/admin/products/[productId]` | `manageCatalogue` | `app/admin/(protected)/products/[productId]/page.tsx:27` |
| `saveProductAction`, `archiveProductAction`, `restoreProductAction`, `deleteProductAction` | `manageCatalogue` | `app/admin/(protected)/products/actions.ts:81,330,360,395` |
| `/admin/inventory` | `manageInventory` | `app/admin/(protected)/inventory/page.tsx:50` |
| `adjustStockAction` | `manageInventory` (RPC `admin_adjust_stock` re-checks role) | `app/admin/(protected)/inventory/actions.ts:27-52` |
| `/admin/orders` | `manageOrders` | `app/admin/(protected)/orders/page.tsx:63` |
| `/admin/orders/[orderId]` | `manageOrders` | `app/admin/(protected)/orders/[orderId]/page.tsx:32` |
| `updateOrderStatusAction`, `addOrderNoteAction`, `updateTrackingAction` | `manageOrders` | `app/admin/(protected)/orders/actions.ts:36,73,118` |
| `/admin/customers` | `viewCustomers` | `app/admin/(protected)/customers/page.tsx:42` |
| `/admin/customers/[customerId]` | `viewCustomers` | `app/admin/(protected)/customers/[customerId]/page.tsx:25` |
| `/admin/administrators` | `manageAdministrators` (super only) | `app/admin/(protected)/administrators/page.tsx:24` |
| `createAdministratorAction`, `changeAdministratorRoleAction`, `setAdministratorStateAction` | `requireSuperAdmin` | `app/admin/(protected)/administrators/actions.ts:49,154,212` |
| `/admin/audit-logs` | any admin (RLS scopes: super reads all, admin reads own) | `app/admin/(protected)/audit-logs/page.tsx:52` |
| `/admin/search` | any admin + capability gating per entity | `app/admin/(protected)/search/page.tsx:30,55-77` |
| `/admin/media` | `manageMedia` | `app/admin/(protected)/media/page.tsx:47` |
| `/admin/media/api` (route handler) | `manageMedia` (`adminContext("manageMedia")`) | `app/admin/(protected)/media/api/route.ts:30-55` |
| `uploadMediaAction`, `updateMediaMetadataAction`, `deleteMediaAction` | `manageMedia` | `app/admin/(protected)/media/actions.ts:45,147,207` |
| `/admin/categories` | `manageCategories` | `app/admin/(protected)/categories/page.tsx:13` |
| Category create/update/delete actions | `manageCategories` | `app/admin/(protected)/categories/actions.ts:39,88,149` |
| `/admin/content` | `manageContent` | `app/admin/(protected)/content/page.tsx` |
| `toggleFeaturedAction` | `manageContent` | `app/admin/(protected)/content/actions.ts:24` |
| `/admin/settings` | `manageSettings` | `app/admin/(protected)/settings/page.tsx:12` |
| `updateSettingsAction` | `manageSettings` (sensitive keys additionally gated by row `is_sensitive` + RLS `super_admin`) | `app/admin/(protected)/settings/actions.ts:32-96` |
| `/admin/appearance` | `manageTheme` | `app/admin/(protected)/appearance/page.tsx:30` |
| `/admin/appearance/preview` | `manageTheme` + valid preview cookie | `app/admin/(protected)/appearance/preview/page.tsx:49-62` |
| `saveDraftAction`, `discardDraftFormAction`, `publishThemeAction`, `publishThemeFormAction`, `restoreRevisionAction`, `restoreRevisionFormAction`, `enterPreviewAction`, `leavePreviewAction` | `manageTheme` (and signed cookie for preview) | `app/admin/(protected)/appearance/actions.ts:43,86,99,125,144,178,201,219` |
| `/admin/blog` | `manageBlog` | `app/admin/(protected)/blog/page.tsx:34` |
| `/admin/blog/new` | `manageBlog` | `app/admin/(protected)/blog/new/page.tsx:11` |
| `/admin/blog/[postId]` | `manageBlog` | `app/admin/(protected)/blog/[postId]/page.tsx:32` |
| `/admin/blog/[postId]/preview` | `manageBlog` + valid `kabia_blog_preview` cookie bound to `postId` + `userId` | `app/admin/(protected)/blog/[postId]/preview/page.tsx:41-48` |
| `saveBlogPostAction`, `autosaveBlogPostAction`, `publishBlogPostAction`, `unpublishBlogPostAction`, `scheduleBlogPostAction`, `archiveBlogPostAction`, `duplicateBlogPostAction`, `deleteBlogPostAction`, `enterBlogPreviewAction`, `leaveBlogPreviewAction`, blog category/tag actions | `manageBlog` | `app/admin/(protected)/blog/actions.ts:67,191,240,277,308,350,380,440,475,491,503,543,588,619,646` |

### Supabase tables, RLS, RPCs, and grants

RLS is **enabled** on every public-facing table (`supabase/migrations/20260730194554_enable_rls_policies.sql:5-20`, plus later migrations for `user_roles`, `admin_audit_logs`, `inventory_adjustments`, `media_assets`, `site_settings`, `site_theme_settings`, `site_theme_revisions`, `blog_*`). The full inventory is summarised in **Supabase Security Review**.

SECURITY DEFINER functions (search_path pinned, EXECUTE revoked from `public`/`anon` except where intentional):

- `public.handle_new_user()` — trigger only.
- `public.set_review_verification()` — trigger only.
- `public.update_product_rating()` — trigger only.
- `public.create_order(…)` — `EXECUTE` granted to `authenticated` (re-checked `auth.uid()`).
- `public.current_admin_role()`, `public.has_admin_role()`, `public.is_super_admin()`, `public.authorize_admin(role)` — read helpers, `EXECUTE` granted to `authenticated`/`service_role`.
- `public.log_admin_action(…)`, `public.admin_adjust_stock(…)`, `public.admin_update_order_status(…)`, `public.admin_dashboard_metrics(…)`, `public.admin_timeseries(…)`, `public.admin_top_products(…)`, `public.admin_inventory_risk()`, `public.admin_complete_password_change()`, `public.get_published_site_theme()`, `public.is_valid_theme_config(…)`, `public.save_site_theme_draft(…)`, `public.discard_site_theme_draft()`, `public.publish_site_theme(…)`, `public.restore_site_theme_version(…)`, `public.redact_audit_payload(…)`, `public.setting_number(…)`, `public.setting_bool(…)`, `public.enforce_last_super_admin()`, `public.capture_blog_slug_history()` — see migrations for grants; each re-derives the caller from `auth.uid()` and `user_roles` inside its own body.

Storage: a single bucket `product-media` (public-read; mutating ops gated on `public.has_admin_role()`). The original broad anon-read policy was narrowed in `supabase/migrations/20260801001000_media_listing_and_grants_hardening.sql` because it leaked a file listing; public object URLs continue to work without it.

---

## Severity Summary

Confirming the table from the Executive Summary:

- **Critical:** 0
- **High:** 0
- **Medium:** 1 (KABIA-SEC-001)
- **Low:** 5 (KABIA-SEC-002, KABIA-SEC-003, KABIA-SEC-004, KABIA-SEC-005, KABIA-SEC-006)
- **Informational:** 1 (KABIA-SEC-007)

No severity was inflated. The single Medium is a confirmed supply-chain finding
with bounded reachability. All Low-rated items are either deferred concerns
(not fully confirmable without production access) or hardening opportunities
(demonstrated defense-in-depth gaps without an exploited path).

---

## Confirmed Findings

### KABIA-SEC-001 — Vulnerable transitive dependencies bundled inside `next@16.2.12`

- **Severity:** Medium
- **Confidence:** High
- **CWE:** CWE-1395 (Dependency on Vulnerable Third-Party Component); the
  underlying `postcss` advisories also map to CWE-79 (XSS) and CWE-22
  (Path Traversal); the `sharp` advisories map to CWE-1395 via libvips
  inherited CVEs.
- **OWASP:** A06:2021 – Vulnerable and Outdated Components.

**Affected files and lines:**

- `package.json:36` — `"next": "16.2.12"`.
- `package-lock.json` resolves transitive `postcss <=8.5.17` and
  `sharp <0.35.0` inside `next`'s bundled toolchain.

**Affected surfaces:**

- Build-time CSS processing pipeline (postcss is bundled inside `next`).
- Runtime next/image optimizer (sharp is invoked when next/image optimizes
  remote patterns: `picsum.photos`, `fastly.picsum.photos`, and the project's
  own Supabase storage host, per `next.config.ts:7-19`).

**Vulnerable data flow:**

- `postcss`: a CSS source containing unescaped `</style>` could break out of an
  inline-style sink in PostCSS's stringify (`GHSA-qx2v-qp2m-jg93`, severity
  moderate, CVSS 6.1). Two further advisories concern `sourceMappingURL`
  auto-loading and path traversal / arbitrary file disclosure
  (`GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`, both CVSS 7.5).
- `sharp`: inherits libvips CVE-2026-33327 / -33328 / -35590 / -35591
  (`GHSA-f88m-g3jw-g9cj`, severity high). Reachable when next/image
  decodes/processes a remote image served through the optimizer.

**Preconditions:**

- PostCSS path-traversal / file-disclosure: an attacker must supply a CSS
  source that contains a crafted `sourceMappingURL` comment consumed by the
  PostCSS pipeline during build. In this project the CSS pipeline consumes
  `app/globals.css` (committed) and Tailwind input; no end-user-supplied CSS
  enters the build. Reachability is therefore indirect and would require
  supply-chain compromise of a committed dependency or build input.
- sharp/libvips: an attacker must supply a malicious image that next/image
  processes through `sharp`. The only remote hosts allowed by
  `next.config.ts:12-19` are `picsum.photos`, `fastly.picsum.photos`, and the
  project's own Supabase storage host. The Supabase storage bucket
  `product-media` only accepts JPEG/PNG/WebP/AVIF (MIME-checked + byte-probed
  by `lib/admin/image-probe.ts`), and writes are gated on
  `public.has_admin_role()`. A non-administrative attacker cannot place an
  image into the optimizer's reachable set.

**Reproduction / validation steps:**

1. Run `npm audit --json` in the repository root.
2. Observe `metadata.vulnerabilities.total = 3` (all `high` severity under
   npm's rate), reported against `next` (via `postcss`, `sharp`).
3. Inspect `effects` and `nodes`: the vulnerable code lives in
   `node_modules/next/node_modules/postcss` and `node_modules/sharp`.

**Security impact:**

- A reachable postcss path-traversal could disclose build-input files or
  sourcemap contents to an attacker who could inject a crafted CSS comment
  into the build pipeline. No such injection path was found in this repo.
- A reachable sharp/libvips bug could crash or, in the worst case, allow
  arbitrary-file-read from a malformed image. Reachability in this project
  requires either a compromised admin uploading a malicious image or a
  compromised `picsum.photos`/Supabase Storage origin.

**Existing controls:**

- Media uploads are MIME-checked and byte-probed (`lib/admin/image-probe.ts`)
  and admin-only (`lib/admin/media.ts`, `app/admin/(protected)/media/actions.ts:45`).
- The CSS build pipeline consumes only committed inputs.
- The remote-image allowlist is small and trusted (well-known placeholder CDN
  + own Supabase host).

**Why those controls are insufficient:**

- They bound but do not eliminate reachability. The vulnerable transitive
  versions remain present in the dependency tree. A future change that lets
  an admin upload arbitrary CSS, or that adds an untrusted remote image host,
  would activate the vulnerable code paths. The right posture is to track
  upstream `next` patches that bump the bundled `postcss` and `sharp`.

**High-level remediation direction (not implemented):**

- Pin or upgrade `next` to a release that bundles `postcss >= 8.5.18` (or
  whichever version patches GHSA-6g55-p6wh-862q and GHSA-r28c-9q8g-f849) and
  `sharp >= 0.35.0`. `npm audit`'s suggested "fix" (downgrade to
  `next@9.3.3`, a five-major-version regression) is **not** a viable
  remediation; it is an advisory artifact of the version-range overlap. Wait
  for upstream `next` patches or override the transitive resolution via
  `overrides` after validating compatibility.

---

## Deferred or Unconfirmed Concerns

These concerns may be real, but require environment credentials, deployment
behavior, or platform configuration access that was unavailable to this
read-only audit. They are not claimed as confirmed vulnerabilities.

### KABIA-SEC-002 — No application-level rate limiting / lockout on auth paths

- **Severity:** Low (deferred)
- **Confidence:** Medium

**Affected surfaces:**

- Customer sign-in: `lib/auth-context.tsx:106-114` (`login(email, password)`),
  consumed by `components/auth/login-form.tsx:36-59`.
- Customer sign-up: `lib/auth-context.tsx:116-130`, consumed by
  `components/auth/register-form.tsx`.
- Admin sign-in: `app/admin/login/actions.ts:32-79`.
- Password-reset request: `components/auth/login-form.tsx:70-84`.

**Concern:**

No application-level rate limit, captcha, or progressive lockout is implemented
on these paths. The application relies entirely on Supabase Auth's
server-side rate limiting and password brute-force protection. Supabase Auth
imposes its own limits, but the project cannot tune them from within the
repository; they depend on the Auth project configuration. The
`auth_leaked_password_protection` advisor (see KABIA-SEC-004) confirms that
the Have I Been Pwned breached-password check is disabled, partially
weakening the password-side mitigation.

**Why deferred:**

- Confirmation that this is exploitable would require observing live
  authentication rate-limit behavior on the connected project, simulating a
  credential-stuffing attempt against `/giris`, `/kayit`, or
  `/admin/login`. Such testing is destructive and out of scope for this
  read-only audit.

**Existing controls:**

- `lib/admin/login.ts:36-47` resolves the `admin` alias server-side only and
  returns one generic message for every failure mode (`GENERIC_LOGIN_ERROR`),
  so the admin login form cannot be used to enumerate valid usernames.
- Supabase Auth enforces server-side rate limits and rejects compromised
  passwords when "Leaked Password Protection" is enabled (currently disabled,
  KABIA-SEC-004).
- Admin sessions are re-validated by `getUser()` on every navigation, so a
  stolen short-lived token is less useful.

**High-level remediation direction:**

- Add a server-side per-identifier and per-IP rate limit (or rely on
  Supabase Auth's configurable rate limits and confirm they are tuned for
  this project).
- Re-enable Leaked Password Protection (see KABIA-SEC-004).
- Consider adding CAPTCHA on admin sign-in.

---

### KABIA-SEC-003 — `site_settings` script-check does not block the `data:` URL scheme in admin-set strings

- **Severity:** Low (deferred)
- **Confidence:** Medium
- **CWE:** CWE-79 (Stored XSS — protocol-handler sink in admin-set href).
- **OWASP:** A03:2021 – Injection.

**Affected files and lines:**

- `supabase/migrations/20260801000700_site_settings.sql:40-43` — the
  `site_settings_no_script_check` constraint:
  ```sql
  constraint site_settings_no_script_check check (
    value_type <> 'string'
    or (value #>> '{}') !~* '(<\s*script|javascript\s*:|on[a-z]+\s*=)'
  )
  ```
- `lib/admin/schemas.ts:242-264` — `settingValueSchemas.string` only validates
  `z.string().trim().max(500)`. No URL scheme allowlist.
- `app/shop/page.tsx:150-175` and `components/shop/shop-hero-banner.tsx:54-61`
  — the `shop_banner_cta_href` setting is rendered as `<Link href={ctaHref}>`.

**Concern:**

The `site_settings_no_script_check` regex blocks `<script`, `javascript:`,
and inline event-handler-attribute-style `on[a-z]+\s*=` in string-typed
settings. It does **not** block the `data:` URL scheme. An administrator with
`manageSettings` could store a `data:text/html,…` value in
`shop_banner_cta_href`; the storefront would then render it as an `<a
href>`. Modern Chrome/Firefox block top-level navigation to `data:` URLs
through link clicks; older Safari versions historically did not, and `data:`
URLs in `<a target="_blank" rel="…">` contexts can still be ambiguous.
Setting values are admin-trusted, but cheap defense-in-depth could reduce the
trust boundary.

**Why deferred:**

- Exploitability depends on browser behavior for top-level `data:` link
  navigation, which has shifted over time and varies by user-agent; this
  audit cannot reproduce a consistent cross-browser XSS path from this
  finding alone.
- The `manageSettings` permission is restricted to administrative users
  (`admin` and `super_admin`), who are already highly trusted to author
  operational content.

**Existing controls:**

- RLS on `public.site_settings` (`settings_admin_update`, `settings_super_admin_update`)
  restricts writes to admins (sensitive keys to super admins only).
- The application's `settingValueSchemas` re-validates the value type before
  the write (`app/admin/(protected)/settings/actions.ts:50-81`).
- The shop banner is only rendered when `shopBannerVisible()` returns true,
  which requires a non-empty headline + a plausible image URL; a malicious
  href alone won't trigger render (`lib/shop-banner.ts:52-57`).

**High-level remediation direction:**

- Extend `site_settings_no_script_check` (or replicate at the application
  layer in `settingValueSchemas.string` for keys whose values are used as
  hrefs) to reject values matching `^\s*data:` and any other untrusted
  scheme. Use a positive allowlist (`/`, `http:`, `https:`, `mailto:`,
  `tel:`) for URL-typed settings.

---

### Rejected candidates (investigated but not vulnerable)

These candidates were investigated and **rejected**. They appear here so the
coverage of the audit is transparent; they are not findings.

1. **Admin role IDs are client-controllable on the wire in
   `administrators/admin-controls.tsx:178, 195, 209`.** Rejected: the action
   `changeAdministratorRoleAction`/`setAdministratorStateAction` calls
   `requireSuperAdmin()` (`lib/admin/auth.ts:108-112`) and writes through the
   acting admin's own RLS-protected session. The `user_roles_write_super_admin`
   policy (`supabase/migrations/20260801000100…:197-200`) requires
   `public.is_super_admin()`. A non-super-admin calling these actions gets
   `AdminAuthError("forbidden")` then RLS rejection. Horizontal escalation
   is not possible.

2. **`admin_complete_password_change` does not verify that a password change
   actually happened** (documented at
   `supabase/migrations/20260801001200_password_change_flag.sql:13-18`).
   Rejected as a vulnerability: the function cannot set the role, reactivate an
   account, or target another user; it can only clear the caller's own
   `must_change_password` flag. The blast radius of bypass is an administrator
   removing their own reminder to rotate a password they already hold. The
   migration's comment explicitly evaluates and accepts this trade against the
   alternative of exposing the service-role key to a routine screen.

3. **Customer order detail page is a client component that reads `orderId`
   from the URL** (`app/hesabim/siparislerim/[orderId]/page.tsx:19-32`).
   Rejected as an IDOR: `fetchOrder` filters both `order_number` and `user_id`
   (`lib/orders-context.tsx:124-136`), and the `orders_select_own` RLS policy
   independently restricts to `user_id = auth.uid()`. A cross-user order
   number returns no rows.

4. **Customer login `safeNext`** (`components/auth/login-form.tsx:17-22`)
   accepts any value starting with `/`. Rejected as an open redirect: the
   function explicitly rejects `//` (protocol-relative URLs) and Next.js
   `router.push("/…")` treats the value as a same-origin path; no script
   execution carrier.

5. **Admin login `next` parameter** (`app/admin/login/actions.ts:77`)
   accepts values matching `/^\/admin(?:\/[\w\-/[\]]*)?$/`. Rejected as an
   open redirect: the anchored regex disallows spaces, `//`, scheme prefixes,
   and only `/admin`-prefixed same-origin paths.

6. **`loadBlogMediaUsage` constructs a PostgREST `.or()` filter string from
   Storage public URLs and object paths**
   (`lib/admin/queries/media.ts:185-191`). Rejected as filter injection:
   this function is admin-only (called only by `deleteMediaAction`, which
   requires `manageMedia`), the values are server-derived from
   `media_assets` rows whose `object_path` is built from `safeObjectName`
   (slugified stem + random UUID + probed extension, see
   `lib/admin/media.ts:87-100`), and the public URL is composed from the
   project's own Supabase host. There is no path by which an
   attacker-controlled `,` `(` `)` `"` could enter the expression.

7. **Admin list-search `.or()` PostgREST filter strings built from
   `sanitizeSearch()` output** (`lib/admin/queries/products.ts:91-94`,
   `lib/blog/queries.ts:194-196, 348-349`, `app/admin/(protected)/search/page.tsx:55-77`).
   Rejected: `sanitizeSearch` (`lib/admin/queries/products.ts:22-29`) strips
   every character not in `[\p{L}\p{N}\s._-]` and caps at 60 chars, so `,`,
   `(`, `)`, `:`, `"`, `'` cannot survive into the `.or()` mini-language.
   `lib/admin/queries/media.ts:83-85` performs the equivalent strip for the
   media picker.

8. **Cookie `kabia_admin_sidebar` read in the protected layout**
   (`app/admin/(protected)/layout.tsx:130`). Rejected: the value is only
   compared to `"1"` for a cosmetic collapsed-state boolean; no security
   decision is derived from it.

9. **Appearance / blog preview tokens could be replayed cross-route.**
   Rejected: the two preview-cookie modules use **different domain-separation
   strings** in the HMAC derivation
   (`lib/theme-engine/preview-cookie.ts:37` uses
   `"kabia:appearance-preview:v1\0"`; `lib/blog/preview-cookie.ts:47` uses
   `"kabia:blog-preview:v1\0"`), and the cookies are scoped to different
   paths (`/admin/appearance/preview` and `/admin/blog/${postId}/preview`
   respectively). The blog token additionally binds to `postId`, so it
   cannot be replayed against another post by the same administrator. The
   mutual-rejection property is directly unit-tested in
   `tests/blog-preview-cookie.test.ts:49-78` and
   `tests/theme-preview-cookie.test.ts`.

10. **JSON-LD `<script type="application/ld+json" dangerouslySetInnerHTML>`
    in `app/layout.tsx:111-114` and `app/blog/[slug]/page.tsx:151-157`.**
    Rejected: the values come from `lib/site.ts` constants
    (`app/layout.tsx:59-76` is a constant object), and the dynamic post
    JSON-LD (`app/blog/[slug]/page.tsx:124-156`) is
    `JSON.stringify`-rendered with `</` replaced by `\u003c`
    (`app/blog/[slug]/page.tsx:156`), so an admin-authored title containing
    `</script>` cannot break out of the inline script tag. Title and excerpt
    are also length-bounded (`blog_posts.title:2..200`,
    `excerpt:..400`) by the schema (`lib/blog/schema.ts:7-9`).

11. **Theme CSS injection via `<ThemeVars>` `dangerouslySetInnerHTML`
    (`components/theme/theme-vars.tsx:21`).** Rejected: every CSS variable
    is produced by `resolveTheme` (`lib/theme-engine/resolve.ts:90-175`)
    from a closed, enumerated vocabulary (radii ∈
    `[0,2,4,6,8,12,16,20,24,28,32,999]`, border widths ∈ `[0,1,2]`, opacities
    ∈ `[0.08,0.12,0.18,0.24,0.32]`, shadows/typography/density from enum
    sets, see `lib/theme-engine/schema.ts:20-98`). Unknown keys are stripped
    by Zod's `.strict()` (`schema.ts:61,82` etc.). `varsToCss`
    (`resolve.ts:194-198`) writes `${key}: ${value};` pairs whose keys are
    fixed-prefixed identifiers and whose values are the enumerated set. No
    attacker-controlled CSS string enters the inline style block.

12. **Customer card entry form handles full PAN + CVV in component state**
    (`components/account/card-entry-form.tsx:14-60`). Rejected: the comment
    (`card-entry-form.tsx:14-17`) and the submit handler
    (`card-entry-form.tsx:43-58`) only call `addCard({ brand, last4, expiry,
    cardName })`. The table `payment_methods` (`20260730194034…:128-138`)
    stores only `card_brand`, `last4`, `expiry_month`,
    `expiry_year`, `card_name`, `is_default`. The full number and CVV never
    leave the component's local state.

13. **`heval` / `new Function` / `child_process` usage.** A repo-wide grep
    for `eval(`, `new Function(`, `child_process`, `exec(`, `execSync`
    returned only two regex `.exec()` calls in client-side card validation
    (`components/account/card-entry-form.tsx:34`,
    `components/checkout/validation.ts:8`), which are `RegExp.prototype.exec`
    and have no command-execution semantics. No unsafe code-execution APIs are
    used.

14. **`SECURITY DEFINER` functions exposed to `authenticated`/`anon`.**
    Reported by Supabase `security` advisors (summarised in KABIA-SEC-007 as
    Informational hardening, **not** as a vulnerability). Rejected as a
    vulnerability: each exposed function (`admin_dashboard_metrics`,
    `admin_timeseries`, `admin_top_products`, `admin_inventory_risk`,
    `admin_adjust_stock`, `admin_update_order_status`,
    `admin_complete_password_change`, `log_admin_action`,
    `save_site_theme_draft`, `discard_site_theme_draft`,
    `publish_site_theme`, `restore_site_theme_version`, `current_admin_role`,
    `has_admin_role`, `is_super_admin`, `authorize_admin`, `create_order`,
    `get_published_site_theme`, `setting_number`, `setting_bool`) re-checks
    the caller's role and `auth.uid()` inside its own body before doing
    anything privileged. The deliberately documented trade
    (`supabase/migrations/20260801001000…:22-31`) is that `SECURITY INVOKER`
    would break the audit-log write path and the role lookups that RLS itself
    depends on. No confirmed privilege-escalation path was found.

15. **Protected admin layout is not a complete guard on soft navigations
    between `(protected)` siblings.** Already mitigated by every page
    re-calling `requireAdminPage()` / `adminPageContext()` from its own body
    (see **Architecture and Trust Boundaries** §3) — explicitly documented in
    `app/admin/(protected)/layout.tsx:25-32`.

---

## Supabase Security Review

Read-only inspection of project `xlubpolwuseafpcienql`
(`supabase_list_projects`, `supabase_get_advisors(type=security)`).

### Schema and RLS

RLS is enabled on:
`categories`, `products`, `product_variants`, `product_images`, `nutrition_facts`,
`reviews`, `profiles`, `notification_preferences`, `addresses`,
`payment_methods`, `favorites`, `carts`, `cart_items`, `orders`, `order_items`,
`order_status_history`, `user_roles`, `admin_audit_logs`,
`inventory_adjustments`, `site_settings`, `media_assets`,
`site_theme_settings`, `site_theme_revisions`, `blog_categories`,
`blog_tags`, `blog_posts`, `blog_post_tags`, `blog_slug_history`
(across `20260730194554_enable_rls_policies.sql`, `20260801000100…`,
`20260801000200…`, `20260801000500…`, `20260801000700…`, `20260801001300…`,
`20260801001400…`, `20260801004000…`, `20260801200000…`,
`20260803000000_blog_engine.sql`).

### Grant posture (key positive findings)

- `revoke all` issued against `anon` on every admin-only table; minimal
  `grant select/update` issued to `authenticated` only where needed
  (e.g., `20260801000400…:113-118`, `20260801004000…:135-137`).
- `EXECUTE` revoked from `public`/`anon` on all trigger functions and helper
  functions (`20260730195408_harden_function_permissions.sql:7-12`,
  `20260801000100…:101-104, 176-177`, etc.).
- The initially-broad `product_media_public_read` policy on `storage.objects`
  was narrowed in `20260801001000…:35-39` to admin-only SELECT, with public
  object URLs still served via `/storage/v1/object/public/…` (which does
  not consult the SELECT policy).
- All `SECURITY DEFINER` RPCs pin `search_path = public, pg_temp` (or
  `pg_temp` for trigger-only functions owned by the table owner) — see for
  example `20260801000100…:55, 70, 80, 89`, `20260801000200…:83`,
  `20260801000500…:48`, `20260801000800…:54, 110, 173, 207`,
  `20260801200000…:161, 211, 255, 292, 380`.
- Immutability triggers protect `admin_audit_logs`
  (`20260801000200…:139-142`) and `site_theme_revisions`
  (`20260801200000…:93-96`) against `UPDATE`/`DELETE` even if a future
  migration mistakenly adds a write policy.
- The `enforce_last_super_admin` trigger
  (`20260801000100…:114-158`) guards the last active super admin against
  direct SQL, not just the UI.
- Site settings write is structurally constrained: there is **no INSERT or
  DELETE** policy on `public.site_settings`
  (`20260801000700…:60-72`), and the `guard_site_settings_update` trigger
  (`20260801000700…:79-101`) blocks any attempt to move a row's
  `key`/`value_type`/`label`/`group_key`/`is_public`/`is_sensitive`.
- Sensitive settings (e.g., `store_open`, `checkout_enabled`,
  `maintenance_message`) are tagged `is_sensitive = true` and reserved for
  super admins via the `settings_super_admin_update` RLS policy
  (`20260801000700…:69-72`).
- The admin overview views (`admin_product_overview`,
  `admin_inventory_overview`, `admin_customer_overview`) all carry
  `security_invoker = true` plus an explicit `where public.has_admin_role()`
  predicate (`20260801001500_restrict_admin_views.sql:23-90`), so even if a
  grant were widened in the future the views themselves would refuse to
  answer a customer's query.
- Draft privacy: `site_theme_settings` is **never** anon-readable; only
  `get_published_site_theme()` (a `SECURITY DEFINER` RPC returning only
  `published_config`) is `EXECUTE`-granted to `anon`/`authenticated`
  (`20260801200000…:156-173`). The `published_config` column is selected
  only inside the function body.

### Storage

- One bucket: `product-media`, public read via the object-public URL path,
  admin-only mutating policies (`20260801000900_product_media_storage.sql`).
- `file_size_limit` was raised from 5 MB to 10 MB
  (`20260801004000…:144-147`), matching the application-side
  `MEDIA_MAX_BYTES = 10 * 1024 * 1024` (`lib/admin/media.ts:20`).
- `allowed_mime_types` is `['image/jpeg','image/png','image/webp','image/avif']`.
  SVG is intentionally excluded and is rejected again at the byte level by
  `lib/admin/image-probe.ts:39-167`.

### Security advisors (Supabase MCP)

The `supabase_get_advisors(type=security)` call returned these categories:

- 1 × `anon_security_definer_function_executable` on `get_published_site_theme()`
  — intentional: anon can read the published theme and nothing else; the row
  itself is not anon-readable. **Hardening, not vulnerability.**
- 21 × `authenticated_security_definer_function_executable` across the
  admin/dashboard RPCs (`admin_adjust_stock`, `admin_complete_password_change`,
  `admin_dashboard_metrics`, `admin_inventory_risk`, `admin_timeseries`,
  `admin_top_products`, `admin_update_order_status`, `authorize_admin`,
  `create_order`, `current_admin_role`, `discard_site_theme_draft`,
  `has_admin_role`, `is_super_admin`, `log_admin_action`, `publish_site_theme`,
  `restore_site_theme_version`, `save_site_theme_draft`, `setting_bool`,
  `setting_number`, `get_published_site_theme`). Each function re-derives the
  caller from `auth.uid()` and `user_roles` inside its own body. This is the
  intended design documented in `20260801001000…:22-31`.
  **Hardening, not vulnerability (KABIA-SEC-007).**
- 1 × `auth_leaked_password_protection` — disabled. Pre-existing Auth project
  configuration, not introduced by this codebase, and not weakened here.
  Reported as **KABIA-SEC-004 (Low hardening)**.

No `RLS_DISABLED`, `PUBLIC_TABLE`, `UNAUTHORIZED_FOREIGN_KEY`, `SECURITY_INVOKER_VIEW_BYPASSES_RLS`, or `OVERLOADED_FUNCTION` advisories were returned.

### Storage and upload review (consolidated)

- Filenames are never trusted as Storage paths. `safeObjectName()`
  (`lib/admin/media.ts:87-100`) rebuilds the path from a slugified stem,
  a random 8-char UUID prefix, and the **probed** extension (not the
  declared one), folder-prefixed `YYYY-MM/`. Path traversal via `../` or
  NUL bytes is therefore structurally impossible.
- MIME is checked against an allowlist (`MEDIA_MIME_TYPES`) and then
  byte-probed (`lib/admin/image-probe.ts`). Declared-type mismatch with
  probed-type is rejected before upload
  (`lib/admin/(protected)/media/actions.ts:71-76`).
- The bucket's own `allowed_mime_types` and `file_size_limit` are a final
  server-side backstop.
- Listing is admin-only (`product_media_admin_select`,
  `20260801001000…:37-39`).
- Catalogue rows (`media_assets`) are admin-only with `created_by` pinned to
  the caller in the INSERT policy itself
  (`20260801004000…:119-121`); the catalogued row is the second write, and
  on failure the orphaned Storage object is removed again
  (`app/admin/(protected)/media/actions.ts:107-109`).
- Deletion first soft-deletes the catalogue row, then removes the Storage
  object, then (for super admins only) hard-deletes the catalogue row; a
  Storage failure rolls back the soft-delete so the library stays
  consistent (`media/actions.ts:255-276`). Usage is checked before deletion
  (`media/actions.ts:227-253`) so a live product image cannot be removed
  out from under a product.

---

## Authentication and Authorization Review

### Authentication

- **Mechanism:** Supabase Auth (email/password) plus optional OAuth
  (Google/Apple) on the customer side; admin is email/password only.
- **Session validation:** the server uses `supabase.auth.getUser()`
  (validates against the Auth server, not just the JWT) in both the proxy
  (`proxy.ts:103-106`) and the page/action guards
  (`lib/admin/auth.ts:49-82`). Signing the JWT is not sufficient — a
  revoked-but-valid token still gets past `getUser()` if Supabase is the
  one validating it; an inactive `user_roles` row sends the user to
  `/admin/unauthorized` regardless.
- **Cookie security:** Supabase `@supabase/ssr` sets the auth cookies as
  `httpOnly`, `secure` (in production), `sameSite=lax` by default; the
  project adds two additional cookies (`kabia_admin_sidebar`,
  `kabia_appearance_preview`, `kabia_blog_preview`), all of which set
  `httpOnly: true` and `secure: production` explicitly
  (`app/admin/(protected)/appearance/actions.ts:204-210`,
  `app/admin/(protected)/blog/actions.ts:481-487`).
- **Logout:** `adminSignOutAction` calls `supabase.auth.signOut()` then
  redirects to login. Revoking an administrator additionally calls
  `admin.auth.admin.signOut(userId, "global")` to end their existing sessions
  (`app/admin/(protected)/administrators/actions.ts:253-263`). Even when
  the service-role key is unavailable, the role row's `is_active = false`
  denies every request on the next navigation.
- **Stale role state:** roles are intentionally **not** carried in JWT claims.
  `lib/admin/auth.ts:23-32` documents the reasoning: `user_metadata` is
  user-editable, and `app_metadata` claims are stale until a token refresh.
  Every check reads the database. The `role-revocation.test.js` suite
  verifies that a revoked administrator loses access on the next request.
- **Password enforcement:** bootstrap accounts get `must_change_password =
  true`; the protected layout redirects them to `/admin/sifre-degistir`
  before they can render anything else
  (`lib/admin/access.ts:166-169`). The new-password policy is stricter than
  Supabase's (12 chars, mixed case, digit;
  `app/admin/sifre-degistir/actions.ts:25-32` via
  `lib/admin/schemas.ts:287-300`).
- **Auth error handling:** `classifyAuthError`
  (`lib/admin/access.ts:76-95`) distinguishes "unauthenticated" from
  "unavailable". Both the proxy and the protected page guard render a
  stable error state for `unavailable` and never navigate, eliminating the
  redirect-loop class.
- **Username enumeration:** the admin alias `admin → admin@kabia.local` is
  resolved server-side only (`lib/admin/login.ts:36-47`); every failure
  matches every other failure (`GENERIC_LOGIN_ERROR`). The login form
  cannot be used to enumerate which accounts exist.

### Authorization

- **Role vocabulary:** `customer | admin | super_admin` (`lib/admin/roles.ts:9-19`).
  `customer` is the absence of an active admin role row.
- **Layered authorization:** proxy + layout + page + Server Action + RLS
  (see **Architecture and Trust Boundaries**). The `array` of checks is
  designed so that any single bypass is insufficient on its own: RLS is the
  final boundary, and the audit trail records every administrative mutation
  with the server-derived actor.
- **Permissions model:** `PERMISSIONS` (`lib/admin/roles.ts:37-51`) is the
  single source of truth used by both the page guard
  (`requireAdminPage(permission)`) and the action guard
  (`requirePermission(permission)`/`adminContext(permission)`).
  `viewAllAuditLogs` and `manageAdministrators` are super-admin-only.
  `manageSensitiveSettings` is implied by the `settings_super_admin_update`
  RLS policy and the application's per-row `is_sensitive` skip
  (`app/admin/(protected)/settings/actions.ts:61-63`).
- **Code-supplied IDs that affect authorization:** none of the Server Actions
  accept an actor id, role, or "current price/stock/status" argument. The
  inventory RPC re-reads the variant under `FOR UPDATE`
  (`20260801000500…:73-78`); the order-status RPC re-reads the order under
  `FOR UPDATE` (`20260801000600…:147-151`); the product-save action's
  Before/After comparison re-reads the authoritative row
  (`app/admin/(protected)/products/actions.ts:153, 291`). The audit writer
  has no `adminUserId` argument by design
  (`lib/admin/audit.ts:7-17`).
- **Revocation:** setting `is_active = false` immediately denies the next
  request; the optional `admin.auth.admin.signOut(userId, "global")` call
  terminates live sessions. The last-super-admin invariant holds even when
  `service_role` is not configured.
- **Cross-user access (customers):** customer order list and detail are
  filtered by `user_id = userId` in code (`lib/orders-context.tsx:111, 131`)
  in addition to `orders_select_own` RLS
  (`20260730194554_enable_rls_policies.sql:77`). Cart, addresses, payment
  methods, favorites, notification preferences, and profiles all have
  owner-scoped RLS. The admin overview views refuse to answer customer
  queries, so an administrator viewing their own `/hesabim` pages cannot
  accidentally receive the order book.
- **Cached authorization decisions:** none. The verdict is request-scoped
  via React `cache()` (`lib/admin/auth.ts:49`); the published-theme and
  published-settings caches (`lib/theme-settings.ts:111-115`,
  `lib/settings.ts:148-150`) cache only **public** reads that any visitor
  would receive identically.

---

## Storage and Upload Review

(Summarised under **Supabase Security Review** and **Architecture and Trust
Boundaries** above.)

- One public bucket, admin-only writes, byte-probed MIME, rebuilt storage
  paths, size cap, no SVG.
- Soft-delete with Storage-failure rollback and product-reference guard
  before delete.
- Orphan cleanup on catalogue-row insert failure.
- Comment in `lib/admin/media.ts:103-110` documents that the public URL is
  stable and never expires, which is why it (rather than a signed URL) is
  the value persisted on `products.main_image_url` and `product_images.image_url`
  / `storage_path`. A signed URL would rot and is explicitly forbidden
  there.

No path traversal, MIME spoofing, SVG active-content, signed-URL misuse,
service-role exposure, or unauthorized media listing path was found.

---

## Blog and Rich-Text Review

- **Content storage:** the canonical form is the TipTap JSON document stored
  in `blog_posts.content_json` (`20260803000000_blog_engine.sql:98`).
- **Save-time allowlist:** `lib/blog/schema.ts:10-24` parses the submitted
  JSON through `blogContentSchema` (`lib/blog/content.ts:89-93`), which is
  built from `ALLOWED_NODE_TYPES` (`doc, paragraph, text, heading,
  bulletList, orderedList, listItem, blockquote, horizontalRule, hardBreak,
  image`) and `ALLOWED_MARK_TYPES` (`bold, italic, underline, code, link`).
  Unknown node types fail the **whole** parse; nothing is silently dropped
  (`content.ts:62-87`).
- **Link protocol allowlist:** `isSafeLinkHref`
  (`lib/blog/content.ts:28-40`) permits `/`-relative paths and `http:`,
  `https:`, `mailto:` only. `javascript:`, `data:`, `vbscript:`, and any
  unparseable input are rejected. The schema's link `attrs` shape
  (`content.ts:46-51`) constrains `target` to `["_blank", "_self"]`.
- **Image nodes:** the `image.attrs.path` is required to be a non-empty
  string (`content.ts:80-85`); the renderer resolves it through
  `blogImageUrl` (`lib/blog/media.ts:4-9`) to a public Storage URL on the
  `product-media` bucket. Image src is never an attacker-supplied arbitrary
  URL.
- **Render-time fail-safe:** `components/blog/render-content.tsx:111-178`
  re-checks every node type, mark type, and link protocol itself; an
  unknown type renders **nothing**, not its raw text. There is no
  `dangerouslySetInnerHTML` anywhere in the renderer (the file's leading
  comment — `render-content.tsx:8-17` — calls this out explicitly).
- **External links:** `render-content.tsx:53-58` adds
  `target="_blank" rel="noopener noreferrer"` to cross-origin links.
- **JSON-LD injection:** the inline JSON-LD script (`app/blog/[slug]/page.tsx:151-157`)
  uses `JSON.stringify(jsonLd).replace(/</g, "\\u003c")` to neutralise
  `</script>` breakout from admin-authored titles.
- **Draft / scheduled exposure:** the public eligibility predicate
  (`status = 'published' OR (status = 'scheduled' AND published_at <= now())`)
  is expressed once in the RLS policy
  (`20260803000000…:291-293`) and re-applied in every public query
  (`lib/blog/queries.ts:160-165, 178-180, 219-224, 229-238, 256-261, 264-272,
  287-296, 299-307, 320-348`). Even a signed-in administrator browsing the
  public blog in the same session sees only eligible posts
  (`lib/blog/queries.ts:152-165`).
- **Slug history / redirect:** `blog_slug_history` is written only by a
  `SECURITY DEFINER` trigger that fires when a **published** post's slug
  changes (`20260803000000…:213-236`); drafts renaming freely never grow
  history. The redirect resolver is gated through the public-eligibility
  predicate (`lib/blog/queries.ts:230-241`), so a redirect cannot point at
  a draft or archived post. Slug history cannot form a loop because posts
  cannot revert to their prior slug without changing the row (which would be
  captured as a new history row), and the resolved target is the live slug.
- **Search:** `searchPublicPosts` (`lib/blog/queries.ts:340-376`) and the
  admin list search (`lib/blog/queries.ts:398-401`) both run
  `sanitizeSearch` first; terms are length-capped.
- **Author:** `author_name` is a free-text snapshot (max 120 chars,
  `20260803000000…:106`) and `author_id` is kept for internal traceability
  only — never selected by a public query. This avoids joining against
  `profiles` (which is owner-scoped SELECT only).
- **Cover / OG images:** `cover_image_path` / `og_image_path` are
  public-safe snapshots of Storage object paths; cover/OG `_media_id` are
  admin-only references for "is this asset used here?" lookups
  (`20260803000000…:75, 98-113`). The public site derives its image URLs
  from the *path* snapshots, never from `media_assets`.

---

## Theme and Preview Review

- **Schema-validated vocabulary:** `lib/theme-engine/schema.ts:103-125`
  enumerates `shapePreset`, `typographyProfile`, body/display font ids,
  numeric radius/border-width/opacity/icon-stroke tokens, shadow/density
  enums. `.strict()` drops unknown keys on every overrides group
  (`schema.ts:61, 82, 95`).
- **Server re-validation:** `app/admin/(protected)/appearance/actions.ts:55`
  (and the autosave-equivalent path for blog) parses the proposed config
  with `parseThemeConfig` and rejects on any failure.
- **Database re-validation:** the `save_site_theme_draft`,
  `publish_site_theme`, and `restore_site_theme_version` RPCs re-validate
  against `public.is_valid_theme_config` (`20260801200000…:183-202`,
  `20260801210000…`'s versions of the same functions). A hand-crafted RPC
  call with arbitrary JSON is rejected by the database itself.
- **No-write policy on theme tables:** `site_theme_settings` and
  `site_theme_revisions` have **no INSERT/UPDATE/DELETE** policy — writes
  only go through the definer RPCs. Immutability triggers protect the
  revision table from future policy mistakes (`20260801200000…:83-98`).
- **Preview-token architecture** (`lib/theme-engine/preview-cookie.ts`,
  `lib/blog/preview-cookie.ts`):
  - HMAC-SHA256 over a base64url JSON payload; signature compared with
    `timingSafeEqual`.
  - Domain-separation strings differ between blog and appearance
    (`"kabia:appearance-preview:v1\0"` vs `"kabia:blog-preview:v1\0"`); the
    signing secret is derived from `process.env.SUPABASE_SERVICE_ROLE_KEY`
    via `createHash("sha256")`, so the underlying service key never appears
    in tokens.
  - Tokens bind to `sub` (the acting admin's UUID), and blog tokens
    additionally bind `postId`; cross-user or cross-post replay fails
    verification.
  - TTL capped at 600 s, clock-skew 30 s, and `(exp - iat)` re-checked so
    a payload that claims a longer lifetime fails.
  - Cookie path-scoped: `/admin/appearance/preview` and
    `/admin/blog/${postId}/preview` respectively, so a preview cookie is
    never sent on other routes.
  - Verification failures fail **closed** (return false; the preview page
    redirects to the editor).
  - The preview routes themselves also pass through the page guard
    (`adminPageContext("manageTheme")` / `adminPageContext("manageBlog")`)
    on every request, so a revoked administrator loses preview access
    immediately, even if their short-lived cookie is still within the TTL.
- **Preview-canvas scope:** the appearance preview's draft CSS is scoped to
  `.theme-preview-scope` (`app/admin/(protected)/appearance/preview/page.tsx:78, 82`),
  so it cannot leak from the admin shell when the operator returns.
- **Cache isolation:** the preview routes set `dynamic = "force-dynamic"`
  and `revalidate = 0`, so draft CSS is never cached for other visitors.
  The published-theme cache is only updated by `updateTag(SITE_THEME_TAG)`
  when the publish RPC commits.

---

## Dependency and Supply-Chain Review

### Manifest

- `package.json:20-45` declares 23 production dependencies and 9
  development dependencies. No preinstall/postinstall install scripts in
  `package.json` itself.
- `allowScripts` (`package.json:58-61`) explicitly allow-lists only
  `sharp@0.34.5` and `unrs-resolver@1.12.2` (lifecycle scripts for all
  other transitive packages are disabled) — defense-in-depth against
  `npm` lifecycle-script supply-chain attacks.

### npm audit (run 2026-08-03)

`npm audit --json` reported `metadata.vulnerabilities.total = 3`
(3 × `high` under npm's own rating), all reachable through `next`:

1. `postcss` (in `node_modules/next/node_modules/postcss`):
   - `GHSA-qx2v-qp2m-jg93` — XSS via unescaped `</style>` in stringify
     output (moderate, CVSS 6.1, CWE-79, range `<8.5.10`).
   - `GHSA-6g55-p6wh-862q` — Arbitrary-file-read / information disclosure
     via attacker-controlled `sourceMappingURL` in CSS comments (high,
     CVSS 7.5, CWE-22 / CWE-200, range `<=8.5.11`).
   - `GHSA-r28c-9q8g-f849` — Path traversal in sourceMappingURL
     auto-loading (high, CVSS 7.5, CWE-22, range `<=8.5.17`).
2. `sharp` (in `node_modules/sharp`):
   - `GHSA-f88m-g3jw-g9cj` — inherited libvips CVE-2026-33327,
     CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 (high,
     CWE-1395, range `<0.35.0`).

npm's `fixAvailable` proposes `next@9.3.3` (a five-major-version
downgrade). This is an artefact of the version-range overlap, **not** a
real remediation path; it is reported here as evidence, not as a
recommendation. See **KABIA-SEC-001** for the appropriate remediation
direction.

### Secrets scanning

- No tracked file matched `env`, `secret`, `key`, `cred`, `token`, `password`
  beyond `.env.example`, `app/admin/sifre-degistir/password-form.tsx`
  (UI only), and the password-change-flag migration (DDL only) — see
  `git ls-files` results in **Test and Tool Results**.
- `.gitignore` excludes `.env*` except `.env.example`
  (`.gitignore:33-34`) and `.admin-bootstrap-credentials`
  (`.gitignore:44-45`).
- `.env.example` documents that no `SUPABASE_SERVICE_ROLE_KEY` value
  should ever carry a `NEXT_PUBLIC_` prefix (`.env.example:6-8, 10-14`).
- `lib/supabase/admin.ts:1` carries `import "server-only"`; a client
  component importing the service-role module is a build error.
- The bootstrap script (`scripts/bootstrap-admin.ts`) writes a generated
  password only to `.admin-bootstrap-credentials` with `0o600`
  permissions, never prints it, and is intended to be deleted after first
  sign-in (`scripts/bootstrap-admin.ts:262-288`). The file is in
  `.gitignore`.
- No `process.env.SUPABASE_SERVICE_ROLE_KEY` reference appears in any file
  that lacks `import "server-only"` or that ships to the browser:

  ```
  $ rg "SUPABASE_SERVICE_ROLE_KEY" --glob '!node_modules' -l
  .env.example
  lib/supabase/admin.ts
  lib/blog/preview-cookie.ts
  lib/theme-engine/preview-cookie.ts
  scripts/bootstrap-admin.ts
  ```
  All five are server-only by `import "server-only"` (admin.ts,
  preview-cookie.ts × 2) or by being a build-time bootstrap script never
  imported by an application module.

### Lockfile

- `package-lock.json` is present and version 3. No `npm ci` mismatch was
  reported; `npm audit` ran cleanly against the lockfile.

---

## Security Headers and Deployment Review

### `next.config.ts` (`next.config.ts:1-32`)

- No `headers()` export. No `poweredByHeader: false`.
- No `Content-Security-Policy`, no `X-Frame-Options`, no
  `X-Content-Type-Options`, no `Referrer-Policy`, no `Permissions-Policy`,
  no `Strict-Transport-Security`.
- `images.remotePatterns` allowlist is minimal: `picsum.photos`,
  `fastly.picsum.photos`, and (only when `NEXT_PUBLIC_SUPABASE_URL` is
  set) the project's own Supabase storage host. No wildcard hosts.
- No open-redirect risk from `redirects()` (`next.config.ts:20-29`):
  three constant mappings (`/admin/apperance`, `/farm`, `/contact`) into
  the same origin; no user-controllable destination.

### `proxy.ts` (`proxy.ts:1-156`)

- Matcher: `/((?!_next/static|_next/image|_next/webpack-hmr|favicon\.ico).*)`
  — correct exclusion of static assets, image optimizer, and HMR socket.
- The proxy sets `x-kabia-admin-guard: 1` on every admin response so the
  guard can be verified externally (`proxy.ts:74-77`).
- No header writing or stripping otherwise.

### Deployment / Vercel

- No `.vercel/` directory is tracked; deployment configuration outside
  the repo is out of scope.
- `app/admin/(protected)/layout.tsx:11-14` sets
  `robots: { index: false, follow: false }` for the dashboard, and
  every public route sets `robots` appropriate to whether it should be
  indexed (e.g., `/giris`, `/kayit`, `/sepet`, `/odeme` are
  `index: false`).
- Source maps: not configured on or off explicitly in `next.config.ts`;
  Next.js 16 emits source maps in production builds by default. They are
  served under `/_next/static/...` and would be publicly accessible on a
  deployed host. This is a Low hardening note — source maps can disclose
  source structure but not secrets (the audit found no secrets committed
  in tracked files; environment-only secrets cannot leak via source maps).

### Hardening gap (KABIA-SEC-006)

No explicit security headers / CSP / frame-options / mime-sniff / referrer
/ permissions-policy / HSTS configuration. The application depends on
Next.js's framework defaults and whatever the hosting platform inserts.
This is reported as **Low** because the absence was confirmed, but a
real attack requires another vulnerability to chain (e.g., a stored XSS
vector that does not exist in the audited code) plus a deployment with
lax defaults.

---

## Test and Tool Results

### `npm run typecheck` (2026-08-03)

```
> tsc --noEmit
```
Exit `0` — clean. No TypeScript errors.

### `npm run lint` (2026-08-03)

Exit `0`. 4 lint errors (`react-hooks/set-state-in-effect`) and 2
unused-import warnings, summarised below. **None** are security findings;
they are reported for completeness:

```
app/admin/(protected)/categories/category-form.tsx:38    error  react-hooks/set-state-in-effect
app/admin/(protected)/orders/[orderId]/order-controls.tsx:50  error  react-hooks/set-state-in-effect
app/admin/(protected)/categories/page.tsx:2  warning  'Link' is defined but never used
app/admin/(protected)/orders/[orderId]/order-controls.tsx:34  warning  'orderNumber' defined but never used
```

### `npm test` (2026-08-03)

```
ℹ tests 234   suites 59   pass 234   fail 0   cancelled 0   skipped 0   todo 0
ℹ duration_ms 7844
```

The directly security-relevant suite results include:

- `tests/admin-authorization.test.ts` — admin access decision matrix.
- `tests/admin-access.test.ts`, `tests/admin-routes.test.js`,
  `tests/admin-direct-entry.test.js` — admin route guards and direct-entry
  protection.
- `tests/role-revocation.test.js` — revoked-admin loses access on next
  request (requires `.env.local`).
- `tests/blog-content.test.ts` — accepts valid, rejects `iframe`,
  javascript:, data:, unknown marks, unknown nodes, H1, image-without-path.
- `tests/blog-preview-cookie.test.ts` — verifier rejects cross-admin /
  cross-post / tampered / malformed / expired tokens; blog token does not
  verify as appearance token and vice versa.
- `tests/theme-preview-cookie.test.ts`,
  `tests/theme-engine-resolver.test.ts`,
  `tests/theme-engine-auth.test.ts`,
  `tests/theme-editor-ui.test.ts` — preview-token scope, resolver
  fallbacks, and editor mutation safety.
- `tests/routes.test.js`, `tests/client-boundary.test.js`,
  `tests/blog-slug.test.ts`, `tests/affected-route-contracts.test.ts`,
  `tests/affected-routes.production.spec.ts` — route inventory and
  keep-the-server-up contracts.

### `npm audit --json` (2026-08-03)

See **KABIA-SEC-001** and **Dependency and Supply-Chain Review**.

### Secret scanning (2026-08-03)

```
$ git ls-files | grep -iE 'env|secret|key|cred|token|password'
.env.example
app/admin/sifre-degistir/password-form.tsx
supabase/migrations/20260801001200_password_change_flag.sql
```
No tracked file contains a service-role key, anon key material, password
value, or other live secret. `.env.local` exists locally with file mode
`-rw-------` (0600) but is in `.gitignore` and was never staged.

### Supabase security advisors (read-only, 2026-08-03)

Project `xlubpolwuseafpcienql`. The advisor output is summarised in the
**Supabase Security Review** section. No `RLS_DISABLED`,
`PUBLIC_TABLE`, `UNAUTHORIZED_FOREIGN_KEY`,
`SECURITY_INVOKER_VIEW_BYPASSES_RLS`, or `OVERLOADED_FUNCTION` advisory
was returned.

### Static searches for unsafe APIs (2026-08-03)

```
$ grep -rE "Content-Security-Policy|contentSecurityPolicy|headers\(\)|x-frame|X-Frame|X-Content-Type|Strict-Transport" .
tests/affected-routes.production.spec.ts (test-time artefacts only)
tests/dev-server-stability.spec.ts     (test-time artefacts only)

$ grep -rn "eval\(|new Function\(|child_process|exec\(|execSync" (app/, lib/, components/, scripts/)
components/account/card-entry-form.tsx:34  // RegExp.prototype.exec — not OS exec
components/checkout/validation.ts:8         // RegExp.prototype.exec — not OS exec

$ grep -rn "dangerouslySetInnerHTML" .
app/layout.tsx:106                          // themeInitScript (static, server-defined)
app/layout.tsx:113                          // organizationJsonLd (constant, server-defined)
app/blog/[slug]/page.tsx:156                // JSON-LD with </ → \u003c escape
components/theme/theme-vars.tsx:21          // enumerated CSS variables (no user input)
app/admin/(protected)/appearance/preview/page.tsx:82  // draft CSS from enumerated variables
components/blog/render-content.tsx:16       // comment, not usage
```
Each use was individually reviewed and rejected as a vulnerability; see
**Rejected candidates** §10, §11 and the **Blog and Rich-Text Review** ·
**JSON-LD injection** note.

---

## Coverage

### Review coverage by directory

| Directory | Files reviewed | Coverage |
| --- | --- | --- |
| `app/admin/login`, `app/admin/sifre-degistir`, `app/admin/unauthorized`, `app/admin/(protected)/**` (page + actions + components) | every `.ts`/`.tsx` | full |
| `app/{public,shop,blog,sepet,odeme,giris,kayit,hesabim}/**` | every `.ts`/`.tsx` | full |
| `lib/admin/**`, `lib/supabase/**`, `lib/blog/**`, `lib/theme-engine/**`, `lib/{auth-context,cart-context,checkout-context,orders-context,cards-context,favorites-context,settings,site,products,catalog,fonts,theme-settings,theme,shop-banner,...}` | every `.ts`/`.tsx` | full |
| `components/{admin,blog,cart,checkout,account,auth,layout,shop,theme,home,motion,ui,providers}` | every `.ts`/`.tsx` | full |
| `supabase/migrations/**` | all 29 migration files | full |
| `scripts/bootstrap-admin.ts` | full | full |
| `tests/**` | directory listing + directly security-relevant suites read | partial (test plumbing not exhaustively line-reviewed; security-relevant assertions verified) |
| `proxy.ts`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `playwright.config.ts`, `playwright.dev.config.ts` | full | full |
| `.env.example`, `.gitignore`, `package.json`, `package-lock.json` | full | full |
| `node_modules/` | not line-reviewed; resolved versions cross-checked against `npm audit` | partial |

### Entry-point inventory coverage

- All public route handlers and Server Actions were enumerated and
  individually read (see **Attack Surface Inventory**).
- All admin Server Actions were verified to call `requireAdmin`,
  `requirePermission`, `requireSuperAdmin`, or `adminContext` before
  performing a privileged operation (pattern grep returned 100 hits and
  each was cross-checked).
- All `SECURITY DEFINER` functions were enumerated and individually read
  (29 migrations × relevant SQL sections).
- All `use server` exports were reviewed for eligibility (every export is
  an async function; constants live in `lib/admin/media.ts` to avoid the
  Next.js rule that strips server-action files of non-async exports —
  see comment in `app/admin/(protected)/media/actions.ts:18-26`).

---

## Limitations

- **No live exploitation** was attempted. Findings rest on static review,
  the supplied unit-test suite, and read-only advisor output. Issues that
  would only manifest at runtime (e.g., exact Supabase Auth rate-limit
  behaviour, real OAuth provider behaviour, third-party analytics) could
  not be confirmed.
- **Deployment platform configuration** (Vercel project settings, CDN/WAF,
  Auth provider configuration in the Supabase dashboard beyond what the
  advisor exposed) was not inspected. KABIA-SEC-002 (auth rate limiting)
  and KABIA-SEC-006 (security headers) therefore are reported as deferred
  or hardening rather than confirmed vulnerabilities.
- **Lockfile drift / overrides:** only the resolved `package-lock.json`
  at commit `9a13e1d` was audited. Future dependency changes were not
  evaluated.
- **Test plumbing** (`tests/affected-routes.production.spec.ts`,
  `tests/dev-server-stability.spec.ts`, `tests/affected-route-contracts.test.ts`)
  was read for intent but not line-reviewed exhaustively; the
  security-relevant assertions in those suites (and the specifically
  security-focused suites) were verified by direct file reads.
- **Out-of-tree secrets** (operator-managed CI/CD secrets, Vercel
  environment variables, Supabase dashboard stored secrets) cannot be in
  the repository by definition; their absence was confirmed only to the
  extent that `git ls-files` and `.gitignore` allow.
- **Edge Function / Realtime / Storage reserved bucket** audit: no Edge
  Functions are deployed by this repo; Supabase Realtime is not used;
  only one Storage bucket exists. The Storage bucket policy was reviewed
  in migration `20260801000900…` and `20260801001000…`.

---

## Prioritized Remediation Order

When the team chooses to act, the suggested priority (highest-risk/lowest-cost
first) is:

1. **KABIA-SEC-001 — Vulnerable dependencies.** Track upstream `next`
   patches that bump bundled `postcss` to `>= 8.5.18` and `sharp` to
   `>= 0.35.0`. Do **not** apply npm's suggested downgrade to `next@9.3.3`.
   Consider an `overrides` entry for `postcss` once Next.js compatibility
   is confirmed.
2. **KABIA-SEC-004 — Re-enable Leaked Password Protection** in the Supabase
   Auth project. Project-level toggle; no code change. Lowest cost, immediate
   credential-stuffing defense.
3. **KABIA-SEC-002 — Auth rate limiting / lockout.** Either confirm that
   Supabase Auth's built-in limits are tuned for the expected traffic,
   or add a server-side per-identifier/per-IP limiter and CAPTCHA on
   admin sign-in.
4. **KABIA-SEC-006 — Security headers.** Add `next.config.ts.headers()` to
   emit `Content-Security-Policy` (without `unsafe-inline` once the
   theme-init and theme-vars inline styles are revisited), `X-Frame-Options:
   SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Permissions-Policy` for the project's
   used features, and `Strict-Transport-Security` (the last is normally
   set by the hosting platform if HTTPS is terminated there, but explicit
   is better).
5. **KABIA-SEC-003 — `data:` URL scheme in `site_settings` strings.**
   Extend the `site_settings_no_script_check` regex or add a
   per-key URL-scheme allowlist in `settingValueSchemas.string` for keys
   whose values are used as hrefs (`shop_banner_cta_href`).
6. **KABIA-SEC-005 — Order status transition relaxation.** Re-introduce
   guidelines for terminal-state (re-)opening (e.g., require a note and
   a confirmation step when reviving an `iptal_edildi` or
   `teslim_edildi` order). The audit trail already captures every
   change; this is operational hardening.
7. **KABIA-SEC-007 — `EXECUTE` grants on `SECURITY DEFINER` RPCs.** This
   is the documented intentional design; no urgent action. Track it as a
   longer-term least-privilege refinement: keep `current_admin_role`,
   `has_admin_role`, `is_super_admin`, `authorize_admin`, `get_published_site_theme`,
   `setting_number`, `setting_bool` on `authenticated`/`anon` (these must
   be callable by RLS sub-queries); audit whether the admin-mutating RPCs
   could be moved to `service_role`-only invocation now that the dashboard
   uses an authenticated session, without breaking the audit-log path.

---

## Conclusion

The Kabia codebase is built with a clear, layered security posture centred on
a database-backed role model, per-request role re-validation, append-only audit
trail, `SECURITY DEFINER` RPCs that re-derive the actor from `auth.uid()`, and
an allowlist-based rich-text/renderer pipeline. The audit found **no exploitable
authentication-bypass, authorization-bypass, IDOR, RLS bypass, stored XSS,
theme-CSS injection, preview-token forgery, open-redirect, SQL-injection, or
path-traversal vulnerability** in the audited code.

The single **confirmed supply-chain finding** (KABIA-SEC-001, Medium) reflects
transitive dependency vulnerabilities with bounded reachability through the
`next` image-optimizer and CSS build pipeline; it is not under the project's
direct code control and should be tracked against upstream `next` patches.

Two **deferred concerns** (authentication rate limiting; `data:` URLs in
admin-set strings) and four **hardening opportunities** (Leaked Password
Protection; relaxed order-status transition; security headers;
`SECURITY DEFINER` EXECUTE grants) round out the report. None represent an
immediate integrity or confidentiality breach; they are defense-in-depth gaps
or deployment-confirmation items that the team should track on the
prioritized remediation order.

No application code, configuration, migrations, RLS, grants, Storage policies,
environment, or production data was modified during this audit. The only new
file is this report at `docs/security/security-audit-2026-08-03.md`.