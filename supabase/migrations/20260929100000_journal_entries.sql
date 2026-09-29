-- ---------------------------------------------------------------------------
-- Journal ("Saha Notları") moves from content/journal.ts into the database.
--
-- WHAT
--   public.journal_entries        one row per dated field note; every field the
--                                 code-side entry had (slug, date, location,
--                                 weather, orchardState, application,
--                                 observation, outcome, photo, video) plus
--                                 publish state.
--   public.journal_entry_images   ordered gallery, the same shape as
--                                 product_images (image_url + storage_path +
--                                 alt_text + sort_order). journal_entries.
--                                 cover_image_url plays the role of
--                                 products.main_image_url: it names one of the
--                                 gallery images (enforced by the save RPC).
--
-- WHY
--   For journal images to be chosen and ordered from the media library, the
--   entries themselves must live in the database. Nothing reads these tables
--   until the matching application code is deployed, so applying this ahead of
--   a deploy is safe.
--
-- DESIGN CHOICES (approved in the Phase 0 plan)
--   * Publish state is a boolean, like producers.is_published.
--   * Entries are ordered by entry_date (every page already does this); there
--     is deliberately no sort_order column.
--   * The slug is the public URL and is immutable after creation (guard
--     trigger) so a published URL can never silently 404.
--   * An entry can only be deleted while unpublished (RLS), so a live URL is
--     never deleted in one step.
--   * video_path stays a plain local path (/images/*.mp4|webm): the media
--     bucket accepts images only, and the CSP has no media-src for a
--     Supabase-hosted video. See the report's "known limitations".
--
-- SECURITY
--   RLS on both tables. Public read of published rows only (the gallery via its
--   parent), admin write via has_admin_role() — the same pattern as producers
--   and product_images. Default grants are narrowed the way media_assets
--   narrowed them: anon gets SELECT only, authenticated gets the four DML
--   privileges, nobody gets TRUNCATE/TRIGGER/REFERENCES.
--
-- ROLLBACK
--   drop table public.journal_entry_images;
--   drop table public.journal_entries;
--   drop function public.touch_journal_entry_updated_at();
--   drop function public.guard_journal_entries_immutable();
--   Nothing outside the journal depends on these objects.
-- ---------------------------------------------------------------------------

create table if not exists public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  slug            text        not null,
  entry_date      date        not null,
  location        text        not null,
  weather         text        not null,
  orchard_state   text        not null,
  application     text        not null,
  observation     text        not null,
  outcome         text        not null,
  cover_image_url text,
  video_path      text,
  is_published    boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint journal_entries_slug_shape_check check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80
  ),
  constraint journal_entries_text_check check (
    char_length(btrim(location))      between 1 and 120  and
    char_length(btrim(weather))       between 1 and 120  and
    char_length(btrim(orchard_state)) between 1 and 300  and
    char_length(btrim(application))   between 1 and 400  and
    char_length(btrim(observation))   between 1 and 600  and
    char_length(btrim(outcome))       between 1 and 1000
  ),
  constraint journal_entries_cover_check check (
    cover_image_url is null
    or (char_length(cover_image_url) <= 1000
        and (cover_image_url ~ '^/[^/]' or cover_image_url ~ '^https://'))
  ),
  constraint journal_entries_video_check check (
    video_path is null
    or (char_length(video_path) <= 300
        and video_path ~ '^/[^/]'
        and video_path ~* '\.(mp4|webm)$')
  )
);

comment on table public.journal_entries is
  'Dated field notes shown at /gunluk. is_published gates public visibility, same pattern as producers. Slug is immutable after creation.';
comment on column public.journal_entries.cover_image_url is
  'One of the entry''s gallery images (journal_entry_images.image_url); enforced by admin_save_journal_images().';
comment on column public.journal_entries.video_path is
  'Local /images/*.mp4|webm path. Video is not managed through the image media library.';

create unique index if not exists journal_entries_slug_uniq
  on public.journal_entries (lower(slug));

create index if not exists idx_journal_entries_published_date
  on public.journal_entries (entry_date desc)
  where is_published;

create table if not exists public.journal_entry_images (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid    not null references public.journal_entries (id) on delete cascade,
  image_url    text    not null,
  storage_path text,
  alt_text     text,
  sort_order   integer not null default 0,
  constraint journal_entry_images_url_check check (
    char_length(image_url) <= 1000
    and (image_url ~ '^/[^/]' or image_url ~ '^https://')
  ),
  constraint journal_entry_images_alt_check check (alt_text is null or char_length(alt_text) <= 200),
  constraint journal_entry_images_path_check check (storage_path is null or char_length(storage_path) <= 500),
  constraint journal_entry_images_sort_check check (sort_order >= 0)
);

comment on table public.journal_entry_images is
  'Ordered gallery of a journal entry; the product_images pattern.';

create index if not exists idx_journal_entry_images_entry
  on public.journal_entry_images (entry_id, sort_order);

-- ---- updated_at --------------------------------------------------------------

create or replace function public.touch_journal_entry_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_journal_entries_touch_updated on public.journal_entries;
create trigger trg_journal_entries_touch_updated
before update on public.journal_entries
for each row execute function public.touch_journal_entry_updated_at();

-- ---- slug immutability --------------------------------------------------------
-- Named guard_* so it fires before the touch_* trigger (alphabetical order).

create or replace function public.guard_journal_entries_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_temp
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'Günlük notunun kısa adı değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_journal_entries_immutable on public.journal_entries;
create trigger guard_journal_entries_immutable
before update on public.journal_entries
for each row execute function public.guard_journal_entries_immutable();

revoke execute on function public.guard_journal_entries_immutable()
  from public, anon, authenticated;
revoke execute on function public.touch_journal_entry_updated_at()
  from public, anon, authenticated;

-- ---- RLS ---------------------------------------------------------------------

alter table public.journal_entries       enable row level security;
alter table public.journal_entry_images  enable row level security;

drop policy if exists journal_entries_public_select on public.journal_entries;
drop policy if exists journal_entries_admin_select  on public.journal_entries;
drop policy if exists journal_entries_admin_insert  on public.journal_entries;
drop policy if exists journal_entries_admin_update  on public.journal_entries;
drop policy if exists journal_entries_admin_delete  on public.journal_entries;

create policy journal_entries_public_select on public.journal_entries
  for select to anon, authenticated
  using (is_published = true);

create policy journal_entries_admin_select on public.journal_entries
  for select to authenticated
  using (public.has_admin_role());

create policy journal_entries_admin_insert on public.journal_entries
  for insert to authenticated
  with check (public.has_admin_role());

create policy journal_entries_admin_update on public.journal_entries
  for update to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

-- A published entry is a live URL: it has to be unpublished before it can go.
create policy journal_entries_admin_delete on public.journal_entries
  for delete to authenticated
  using (public.has_admin_role() and not is_published);

drop policy if exists journal_entry_images_public_read on public.journal_entry_images;
drop policy if exists journal_entry_images_admin_select on public.journal_entry_images;
drop policy if exists journal_entry_images_admin_insert on public.journal_entry_images;
drop policy if exists journal_entry_images_admin_update on public.journal_entry_images;
drop policy if exists journal_entry_images_admin_delete on public.journal_entry_images;

create policy journal_entry_images_public_read on public.journal_entry_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.journal_entries e
    where e.id = journal_entry_images.entry_id and e.is_published
  ));

create policy journal_entry_images_admin_select on public.journal_entry_images
  for select to authenticated
  using (public.has_admin_role());

create policy journal_entry_images_admin_insert on public.journal_entry_images
  for insert to authenticated
  with check (public.has_admin_role());

create policy journal_entry_images_admin_update on public.journal_entry_images
  for update to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

create policy journal_entry_images_admin_delete on public.journal_entry_images
  for delete to authenticated
  using (public.has_admin_role());

-- ---- grants ------------------------------------------------------------------

revoke all on public.journal_entries      from anon, authenticated;
revoke all on public.journal_entry_images from anon, authenticated;

grant select on public.journal_entries      to anon;
grant select on public.journal_entry_images to anon;

grant select, insert, update, delete on public.journal_entries      to authenticated;
grant select, insert, update, delete on public.journal_entry_images to authenticated;
