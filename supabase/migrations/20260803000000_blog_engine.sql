-- ---------------------------------------------------------------------------
-- Public blog + admin blog management.
--
-- Five tables:
--   public.blog_categories   — one category per post (not many-to-many).
--   public.blog_tags         — free tagging.
--   public.blog_posts        — the article itself.
--   public.blog_post_tags    — post/tag junction.
--   public.blog_slug_history — old slugs, for permanent redirects after a
--                              published post's slug changes.
--
-- Authorization mirrors the rest of the dashboard exactly: manageBlog is
-- granted to admin + super_admin (see lib/admin/roles.ts), which at the
-- database tier is the same set has_admin_role() already recognises — no new
-- SQL-level permission function is needed, only the existing helper from
-- 20260801000100_admin_roles_and_authorization.sql.
--
-- Public read visibility for blog_posts is expressed once, in one predicate,
-- reused by the RLS policy and documented here so it never drifts:
--
--   status = 'published' OR (status = 'scheduled' AND published_at <= now())
--
-- That is the entire "scheduling" feature. A scheduled post becomes publicly
-- eligible the moment its published_at is reached, with no cron job, no
-- worker and no open-browser-tab dependency — the WHERE clause itself is the
-- scheduler. draft and archived rows are never matched by that predicate.
--
-- media_assets (20260801004000) has no anon/customer policy at all — it is
-- administrative metadata. Rather than widen that policy (which would leak
-- uploader identity and every asset's existence to anonymous visitors), cover
-- images, OG images and inline body images are referenced by *both* a
-- media_asset id (admin-only, for "is this asset referenced by a post?"
-- lookups) and a public-safe object_path snapshot taken at save time — the
-- exact pattern products.main_image_url / product_images.storage_path
-- already uses. The public site never queries media_assets; it derives the
-- Storage public URL from the snapshotted path.
--
-- The same reasoning applies to authorship: profiles is owner-scoped SELECT
-- only, so a public byline cannot be a live join against it. author_name is a
-- free-text snapshot; author_id is kept for internal traceability only and is
-- never read by a public query.
--
-- Rollback: drop the five tables (blog_post_tags and blog_slug_history first,
-- for the foreign keys), then the enum. Nothing outside the blog surface
-- depends on any of it.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'blog_post_status' and n.nspname = 'public'
  ) then
    create type public.blog_post_status as enum ('draft', 'scheduled', 'published', 'archived');
  end if;
end $$;

-- ---- blog_categories --------------------------------------------------------

create table if not exists public.blog_categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 80),
  slug           text not null,
  description    text check (char_length(coalesce(description, '')) <= 400),
  image_media_id uuid references public.media_assets(id) on delete set null,
  image_path     text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.blog_categories is
  'One category per post (blog_posts.category_id). image_path is a public-safe Storage object-path snapshot; media_assets itself is admin-only.';

create unique index if not exists blog_categories_slug_uniq on public.blog_categories (lower(slug));
create index if not exists idx_blog_categories_active on public.blog_categories (sort_order) where is_active;

-- ---- blog_tags ---------------------------------------------------------------

create table if not exists public.blog_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  slug       text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists blog_tags_slug_uniq on public.blog_tags (lower(slug));

-- ---- blog_posts ---------------------------------------------------------------

create table if not exists public.blog_posts (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 2 and 200),
  slug                  text not null,
  excerpt               text check (char_length(coalesce(excerpt, '')) <= 400),
  content_json          jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  cover_media_id        uuid references public.media_assets(id) on delete set null,
  cover_image_path      text,
  category_id           uuid references public.blog_categories(id) on delete set null,
  status                public.blog_post_status not null default 'draft',
  featured              boolean not null default false,
  allow_indexing        boolean not null default true,
  author_id             uuid references auth.users(id) on delete set null,
  author_name           text check (char_length(coalesce(author_name, '')) <= 120),
  published_at          timestamptz,
  scheduled_at          timestamptz,
  seo_title             text check (char_length(coalesce(seo_title, '')) <= 70),
  seo_description       text check (char_length(coalesce(seo_description, '')) <= 200),
  canonical_url         text check (char_length(coalesce(canonical_url, '')) <= 500),
  og_media_id           uuid references public.media_assets(id) on delete set null,
  og_image_path         text,
  reading_time_minutes  integer not null default 1 check (reading_time_minutes >= 1),
  version               integer not null default 1,
  created_by            uuid references auth.users(id) on delete set null,
  updated_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint blog_posts_published_needs_timestamp
    check (status <> 'published' or published_at is not null),
  constraint blog_posts_scheduled_needs_timestamp
    check (status <> 'scheduled' or published_at is not null)
);

comment on table public.blog_posts is
  'Public eligibility (also the RLS predicate): status = published OR (status = scheduled AND published_at <= now()). content_json is the canonical TipTap document; it is rendered only through the allowlisted server renderer, never as raw HTML.';
comment on column public.blog_posts.cover_image_path is
  'Public-safe Storage object-path snapshot, taken from media_assets at save time. The public site renders from this column, never from media_assets directly.';
comment on column public.blog_posts.author_name is
  'Free-text byline snapshot. profiles is owner-scoped SELECT only, so a public byline cannot be a live join; author_id is kept for internal traceability only.';
comment on column public.blog_posts.version is
  'Bumped by trg_blog_posts_touch on every UPDATE. The editor autosave path sends the version it last read in the WHERE clause, so a stale write affects zero rows instead of silently overwriting newer data.';

create unique index if not exists blog_posts_slug_uniq on public.blog_posts (lower(slug));

-- Backs both the public listing query and the RLS predicate above.
create index if not exists idx_blog_posts_public_eligible
  on public.blog_posts (published_at desc)
  where status in ('published', 'scheduled');

create index if not exists idx_blog_posts_category on public.blog_posts (category_id);
create index if not exists idx_blog_posts_updated on public.blog_posts (updated_at desc);
create index if not exists idx_blog_posts_status on public.blog_posts (status, updated_at desc);

-- Trigram search over title + excerpt, for both the admin list search and the
-- public search box. Bounded, server-side — never a client-side full scan.
create index if not exists idx_blog_posts_search
  on public.blog_posts
  using gin ((coalesce(title, '') || ' ' || coalesce(excerpt, '')) extensions.gin_trgm_ops);

-- ---- blog_post_tags ------------------------------------------------------------

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id  uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create index if not exists idx_blog_post_tags_tag on public.blog_post_tags (tag_id);

-- ---- blog_slug_history --------------------------------------------------------

create table if not exists public.blog_slug_history (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.blog_posts(id) on delete cascade,
  slug       text not null,
  created_at timestamptz not null default now()
);

comment on table public.blog_slug_history is
  'Written only by trg_blog_posts_slug_history, when a published post''s slug changes. /blog/[slug] falls back to this table (most recent match) after a live-slug lookup misses, and issues one permanent redirect to the post''s current slug.';

create index if not exists idx_blog_slug_history_slug on public.blog_slug_history (lower(slug), created_at desc);
create index if not exists idx_blog_slug_history_post on public.blog_slug_history (post_id);

-- ---- updated_at + version touch -----------------------------------------------

create or replace function public.touch_blog_post_updated_at()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
  new.updated_at := now();
  new.version := coalesce(old.version, 1) + 1;
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_touch on public.blog_posts;
create trigger trg_blog_posts_touch
before update on public.blog_posts
for each row execute function public.touch_blog_post_updated_at();

create or replace function public.touch_blog_category_updated_at()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_blog_categories_touch on public.blog_categories;
create trigger trg_blog_categories_touch
before update on public.blog_categories
for each row execute function public.touch_blog_category_updated_at();

-- ---- slug history capture ------------------------------------------------------
-- SECURITY DEFINER so the trigger can insert into blog_slug_history despite
-- that table having no INSERT policy for `authenticated` — the same pattern
-- log_admin_action() uses for admin_audit_logs. Only fires when the row being
-- changed was, at the moment of the UPDATE, live under its old slug (status
-- was already 'published'), so drafts renaming freely never grow history.

create or replace function public.capture_blog_slug_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.slug is distinct from old.slug and old.status = 'published' then
    insert into public.blog_slug_history (post_id, slug) values (old.id, old.slug);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_slug_history on public.blog_posts;
create trigger trg_blog_posts_slug_history
before update on public.blog_posts
for each row execute function public.capture_blog_slug_history();

revoke execute on function public.touch_blog_post_updated_at()     from public, anon, authenticated;
revoke execute on function public.touch_blog_category_updated_at() from public, anon, authenticated;
revoke execute on function public.capture_blog_slug_history()      from public, anon, authenticated;

-- ---- RLS ------------------------------------------------------------------

alter table public.blog_categories   enable row level security;
alter table public.blog_tags         enable row level security;
alter table public.blog_posts        enable row level security;
alter table public.blog_post_tags    enable row level security;
alter table public.blog_slug_history enable row level security;

-- categories: active categories are public (same openness as public.categories
-- for products); the "only show filters with published posts" rule from the
-- brief is a query-shape concern (count-and-filter), not a row-visibility one.
drop policy if exists blog_categories_public_select on public.blog_categories;
drop policy if exists blog_categories_admin_select   on public.blog_categories;
drop policy if exists blog_categories_admin_write    on public.blog_categories;

create policy blog_categories_public_select on public.blog_categories
  for select to anon, authenticated
  using (is_active = true);

create policy blog_categories_admin_select on public.blog_categories
  for select to authenticated
  using (public.has_admin_role());

create policy blog_categories_admin_write on public.blog_categories
  for all to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

-- tags: lightweight, no draft-adjacent data; public read of all tags is the
-- same openness product_variants / product_images already have.
drop policy if exists blog_tags_public_select on public.blog_tags;
drop policy if exists blog_tags_admin_write    on public.blog_tags;

create policy blog_tags_public_select on public.blog_tags
  for select to anon, authenticated
  using (true);

create policy blog_tags_admin_write on public.blog_tags
  for all to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

-- posts: the one predicate, stated once, used everywhere.
drop policy if exists blog_posts_public_select on public.blog_posts;
drop policy if exists blog_posts_admin_select  on public.blog_posts;
drop policy if exists blog_posts_admin_insert  on public.blog_posts;
drop policy if exists blog_posts_admin_update  on public.blog_posts;
drop policy if exists blog_posts_admin_delete  on public.blog_posts;

create policy blog_posts_public_select on public.blog_posts
  for select to anon, authenticated
  using (status = 'published' or (status = 'scheduled' and published_at <= now()));

create policy blog_posts_admin_select on public.blog_posts
  for select to authenticated
  using (public.has_admin_role());

-- created_by/updated_by are pinned to the caller in the policy itself — an
-- administrator cannot attribute a post to somebody else even by posting a
-- crafted row, mirroring media_assets_admin_insert.
create policy blog_posts_admin_insert on public.blog_posts
  for insert to authenticated
  with check (public.has_admin_role() and created_by = (select auth.uid()));

create policy blog_posts_admin_update on public.blog_posts
  for update to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role() and updated_by = (select auth.uid()));

create policy blog_posts_admin_delete on public.blog_posts
  for delete to authenticated
  using (public.has_admin_role());

-- post_tags: public read only for tags on a currently-eligible post; admins
-- read and write everything.
drop policy if exists blog_post_tags_public_select on public.blog_post_tags;
drop policy if exists blog_post_tags_admin_write    on public.blog_post_tags;

create policy blog_post_tags_public_select on public.blog_post_tags
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts p
      where p.id = post_id
        and (p.status = 'published' or (p.status = 'scheduled' and p.published_at <= now()))
    )
  );

create policy blog_post_tags_admin_write on public.blog_post_tags
  for all to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

-- slug_history: public read only to resolve a redirect for an eligible post;
-- no write policy at all — only the SECURITY DEFINER trigger writes it.
drop policy if exists blog_slug_history_public_select on public.blog_slug_history;
drop policy if exists blog_slug_history_admin_select   on public.blog_slug_history;

create policy blog_slug_history_public_select on public.blog_slug_history
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts p
      where p.id = post_id
        and (p.status = 'published' or (p.status = 'scheduled' and p.published_at <= now()))
    )
  );

create policy blog_slug_history_admin_select on public.blog_slug_history
  for select to authenticated
  using (public.has_admin_role());

-- ---- grants -----------------------------------------------------------------

revoke all on public.blog_categories   from anon, authenticated;
revoke all on public.blog_tags         from anon, authenticated;
revoke all on public.blog_posts        from anon, authenticated;
revoke all on public.blog_post_tags    from anon, authenticated;
revoke all on public.blog_slug_history from anon, authenticated;

grant select on public.blog_categories to anon, authenticated;
grant insert, update, delete on public.blog_categories to authenticated;

grant select on public.blog_tags to anon, authenticated;
grant insert, update, delete on public.blog_tags to authenticated;

grant select on public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;

grant select on public.blog_post_tags to anon, authenticated;
grant insert, update, delete on public.blog_post_tags to authenticated;

grant select on public.blog_slug_history to anon, authenticated;
