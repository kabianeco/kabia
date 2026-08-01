# Database changes — media library

Every remote change is backed by a versioned local migration. Nothing was
applied to Supabase that does not exist in `supabase/migrations/`.

| | |
|---|---|
| Project | `kabia` |
| Ref | `xlubpolwuseafpcienql` |
| Verified against | `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`, compared with `list_projects` over MCP |

No secret values appear in this document or anywhere in the repository.

---

## Migration added

`supabase/migrations/20260801004000_media_assets.sql`
→ applied over MCP as `20260801155134_media_assets`.

It is the **only** migration this work added. Twenty-four earlier migrations
were left untouched; none was edited, reordered or deleted.

---

## 1. New table — `public.media_assets`

```sql
create table public.media_assets (
  id                uuid primary key default gen_random_uuid(),
  bucket_id         text        not null default 'product-media',
  object_path       text        not null,
  original_filename text        not null,
  display_name      text,
  mime_type         text        not null,
  file_size         bigint      not null check (file_size > 0),
  width             integer     check (width is null or width > 0),
  height            integer     check (height is null or height > 0),
  alt_text          text,
  created_by        uuid        not null references auth.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint media_assets_object_unique unique (bucket_id, object_path),
  constraint media_assets_mime_allowed  check (
    mime_type in ('image/jpeg','image/png','image/webp','image/avif')
  )
);
```

Notes on specific choices:

- **`unique (bucket_id, object_path)`** is what makes a row and a Storage object
  one-to-one, and lets deletion reconcile the two.
- **No URL column.** The public URL is derived from the bucket and path. Storing
  it would rot on a project-ref or bucket rename; storing a *signed* URL would
  expire and break the storefront.
- **`created_by … on delete restrict`** so removing an auth user cannot silently
  orphan the attribution on an audited upload.
- **`deleted_at`** is a soft delete, set before the Storage object is removed so
  a partial failure stays visible and retryable.
- **No FK to `product_images` / `products`.** Historical product imagery points
  at `picsum.photos` placeholders with no catalogue row; a constraint would have
  forced rewriting that history. Reference safety is enforced in the application
  against both `storage_path` and `image_url`.

## 2. Indexes

| Index | Definition | Why |
|---|---|---|
| `idx_media_assets_created_at` | `(created_at desc) where deleted_at is null` | default newest-first listing |
| `idx_media_assets_mime` | `(mime_type, created_at desc) where deleted_at is null` | the type filter |
| `idx_media_assets_created_by` | `(created_by)` | covers the FK; uploader lookups |
| `idx_media_assets_search` | GIN trigram over `coalesce(display_name,'') \|\| ' ' \|\| original_filename` | keeps `ilike '%term%'` off a sequential scan as the library grows |

The partial predicates match the listing queries exactly — every listing filters
`deleted_at is null`.

`pg_trgm` was already installed (by `20260801000800_admin_analytics`); no new
extension was added.

## 3. Trigger

`public.touch_media_asset_updated_at()` — `before update`, sets `updated_at`.
`security invoker`, `set search_path = ''`, consistent with the project's other
functions. Verified firing: editing metadata moved `updated_at` past
`created_at`.

## 4. RLS

`alter table public.media_assets enable row level security;`

| Policy | Command | Rule |
|---|---|---|
| `media_assets_admin_select` | SELECT | `public.has_admin_role()` |
| `media_assets_admin_insert` | INSERT | `public.has_admin_role() and created_by = (select auth.uid())` |
| `media_assets_admin_update` | UPDATE | `public.has_admin_role()` both sides |
| `media_assets_admin_delete` | DELETE | `public.is_super_admin()` |

```sql
revoke all on public.media_assets from anon;
grant select, insert, update, delete on public.media_assets to authenticated;
```

Two deliberate decisions:

- **No `anon` policy and no `anon` grant.** The catalogue is administrative
  metadata. The public storefront never reads it — it renders
  `products.main_image_url` and `product_images.image_url`, which are public
  bucket URLs that do not consult this table.
- **`created_by` is pinned in the policy**, so an administrator cannot attribute
  an upload to another user even by posting a crafted row.
- **Hard delete is super-admin only.** An ordinary administrator soft-deletes
  (an UPDATE), which is reversible; purging the record of who uploaded what is
  the security-sensitive operation.

## 5. Storage change

```sql
update storage.buckets set file_size_limit = 10485760 where id = 'product-media';
```

5 MB → 10 MB, so a high-resolution product photograph need not be downsampled
before upload; `next/image` still serves optimised responsive variants.

**No Storage policy was added, changed or removed.** The four policies from
`20260801000900` and `20260801001000` were already correct:

| Policy | Command | Rule |
|---|---|---|
| `product_media_admin_select` | SELECT | `bucket_id = 'product-media' and public.has_admin_role()` |
| `product_media_admin_insert` | INSERT | same |
| `product_media_admin_update` | UPDATE | same |
| `product_media_admin_delete` | DELETE | same |

The bucket remains **public for reads**, which is what lets the storefront serve
permanent, non-expiring image URLs to anonymous visitors. `allowed_mime_types`
still excludes SVG.

No new bucket was created — the brief's instruction not to create duplicate
buckets with overlapping purposes.

---

## Verification performed

```sql
select
  (select count(*) from pg_policies where tablename='media_assets') as policies,   -- 4
  (select count(*) from pg_indexes  where tablename='media_assets') as indexes,    -- 6
  (select relrowsecurity from pg_class where oid='public.media_assets'::regclass), -- true
  (select file_size_limit from storage.buckets where id='product-media'),          -- 10485760
  (select public from storage.buckets where id='product-media');                   -- true
```

Access checks were then run against the live database with the **anon key only**,
so every result was decided by RLS and the Storage policies rather than by
application code:

| Operation | anonymous | downgraded admin (customer) | super admin (control) |
|---|---|---|---|
| Upload to `product-media` | denied | denied | allowed |
| Delete a Storage object | denied | denied | allowed |
| `update products.main_image_url` | denied (0 rows) | denied (0 rows) | allowed |
| `insert product_images` | denied | denied | allowed |
| `select media_assets` | denied | denied (0 rows) | allowed |
| `select admin_audit_logs` | denied | denied (0 rows) | allowed |
| Escalate own role to `super_admin` | denied | denied (0 rows) | allowed |

The super-admin column is the control: without it, a "denied" everywhere could
just mean the probe was broken.

Public product images were confirmed still loading anonymously after every
change.

## Supabase advisors

`get_advisors(type: security)` after the migration returns **no new findings for
`media_assets`** — no `rls_disabled_in_public`, no `policy_exists_rls_disabled`,
no anon exposure.

The warnings it does return are all pre-existing and already documented in
`20260801001000_media_listing_and_grants_hardening.sql`:

- `authenticated_security_definer_function_executable` on the admin RPCs — the
  intended design; each re-checks the caller's role in its own body.
- `auth_leaked_password_protection` disabled — pre-existing Auth project
  configuration, not introduced or weakened here.

## Rollback

```sql
drop trigger if exists trg_touch_media_asset_updated on public.media_assets;
drop function if exists public.touch_media_asset_updated_at();
drop table if exists public.media_assets;          -- policies and indexes go with it
update storage.buckets set file_size_limit = 5242880 where id = 'product-media';
```

Dropping the table does not touch Storage objects; the bucket and its four
policies are independent of it.
