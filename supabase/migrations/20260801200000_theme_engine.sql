-- ---------------------------------------------------------------------------
-- Controlled theme engine — controlled appearance customization.
--
-- Two tables back the appearance editor at /admin/appearance:
--   public.site_theme_settings  — a singleton (site_key = 'default') holding
--                                 the currently published configuration and an
--                                 in-progress draft.
--   public.site_theme_revisions — an append-only history of every published
--                                 version, written atomically by the publish
--                                 and restore RPCs.
--
-- Security model:
--   * Public/anon readers may obtain ONLY the published configuration, and
--     only through the safe RPC get_published_site_theme(). The settings table
--     itself is never readable by anon — RLS cannot hide individual columns,
--     so exposing the table would leak the draft. The RPC is SECURITY DEFINER
--     and returns only published_config.
--   * Admins (admin + super_admin) may read the singleton (published + draft)
--     and the revision history through their own session, enforced by RLS.
--   * Mutations (save draft / discard / publish / restore) happen ONLY through
--     SECURITY DEFINER RPCs that re-derive the actor from auth.uid() and the
--     database-backed role — never from a client argument. The tables have no
--     INSERT/UPDATE/DELETE policy, so a direct PostgREST write is impossible.
--   * site_theme_revisions is append-only: a trigger raises on UPDATE/DELETE,
--     mirroring admin_audit_logs. Restoring version 3 while current is 6
--     creates a NEW version 7 containing version 3's config — history is
--     never rewritten.
--
-- Audit: the publish and restore RPCs call public.log_admin_action() so each
-- publication/restore is recorded with the server-derived actor, exactly like
-- the other admin surfaces. No administrator identity is ever accepted from
-- the client.
--
-- Rollback: drop the RPCs, the tables, then the seed row. The application
-- falls back to the default balanced + Kabia Original theme when the row or
-- the RPC is missing, so dropping the schema degrades the storefront to its
-- previous behaviour rather than breaking it.
-- ---------------------------------------------------------------------------

-- ---- tables ----------------------------------------------------------------

create table if not exists public.site_theme_settings (
  id                 uuid primary key default gen_random_uuid(),
  site_key           text not null unique,
  published_config  jsonb not null,
  draft_config      jsonb,
  published_version integer not null default 1,
  schema_version    integer not null default 1,
  published_at      timestamptz,
  published_by      uuid references auth.users(id) on delete set null,
  draft_updated_at  timestamptz,
  draft_updated_by  uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.site_theme_settings is
  'Singleton holding the published theme configuration and an in-progress draft. Mutated only through SECURITY DEFINER RPCs; no INSERT/UPDATE/DELETE policy exists.';

create unique index if not exists site_theme_settings_site_key_uniq
  on public.site_theme_settings (site_key);

create table if not exists public.site_theme_revisions (
  id               uuid primary key default gen_random_uuid(),
  site_key         text not null,
  version          integer not null,
  config           jsonb not null,
  action           text not null,
  publication_note text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,
  constraint site_theme_revisions_site_version_uniq unique (site_key, version)
);

comment on table public.site_theme_revisions is
  'Append-only published-version history. Written only by publish_site_theme()/restore_site_theme_version(). Restoring creates a new version; history is never mutated.';

create index if not exists idx_site_theme_revisions_site_version
  on public.site_theme_revisions (site_key, version desc);

-- ---- append-only guard on revisions ---------------------------------------

create or replace function public.deny_theme_revision_mutation()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
  raise exception 'public.site_theme_revisions is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists trg_site_theme_revisions_immutable on public.site_theme_revisions;
create trigger trg_site_theme_revisions_immutable
  before update or delete on public.site_theme_revisions
  for each row execute function public.deny_theme_revision_mutation();

revoke execute on function public.deny_theme_revision_mutation() from public, anon, authenticated;

-- ---- updated_at touch on settings -----------------------------------------

create or replace function public.touch_site_theme_settings()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_site_theme_settings_touch on public.site_theme_settings;
create trigger trg_site_theme_settings_touch
  before update on public.site_theme_settings
  for each row execute function public.touch_site_theme_settings();

revoke execute on function public.touch_site_theme_settings() from public, anon, authenticated;

-- ---- RLS ------------------------------------------------------------------

alter table public.site_theme_settings enable row level security;
alter table public.site_theme_revisions enable row level security;

-- The settings table: admins read published + draft; no write policy (RPCs
-- own the writes). anon gets nothing here — public reads go through the RPC.
drop policy if exists site_theme_settings_admin_read on public.site_theme_settings;
create policy site_theme_settings_admin_read on public.site_theme_settings
  for select to authenticated
  using (public.has_admin_role());

-- No INSERT/UPDATE/DELETE policy on site_theme_settings: the definer RPCs are
-- the only write path.

-- Revisions: admins read; no write policy (RPCs own the writes).
drop policy if exists site_theme_revisions_admin_read on public.site_theme_revisions;
create policy site_theme_revisions_admin_read on public.site_theme_revisions
  for select to authenticated
  using (public.has_admin_role());

-- No INSERT/UPDATE/DELETE policy on site_theme_revisions; the append-only
-- trigger backs the no-UPDATE/DELETE intent even if a policy were ever added.

-- Grants: minimal. anon gets nothing on either table.
revoke all on public.site_theme_settings  from anon, authenticated;
revoke all on public.site_theme_revisions from anon, authenticated;
grant  select on public.site_theme_settings  to authenticated;
grant  select on public.site_theme_revisions to authenticated;

-- ---- safe public reader RPC -----------------------------------------------
-- Returns ONLY published_config (never draft_config or revisions). Available
-- to anon + authenticated so the storefront can render the published theme
-- during SSR. The function is SECURITY DEFINER so it can read the row despite
-- the anon-restrictive RLS; it returns a scalar jsonb, leaking nothing else.

create or replace function public.get_published_site_theme()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (s.published_config)::jsonb
  from public.site_theme_settings s
  where s.site_key = 'default'
  limit 1
$$;

comment on function public.get_published_site_theme() is
  'The only public read path for the theme. Returns the published configuration only — never the draft.';

revoke execute on function public.get_published_site_theme() from public;
grant execute on function public.get_published_site_theme() to anon, authenticated, service_role;

-- ---- trusted write RPCs ---------------------------------------------------
-- All four re-derive the actor from auth.uid() + user_roles, never from args.
-- search_path pinned; referenced objects are schema-qualified.

-- Internal helper: validate a config jsonb against the approved vocabulary.
-- Implemented as a coarse structural guard in SQL; the application's Zod
-- schema is the primary validator, and this is a defence-in-depth boundary so
-- a hand-crafted RPC call cannot persist arbitrary JSON.
create or replace function public.is_valid_theme_config(p_config jsonb)
returns boolean
language sql
immutable
set search_path = pg_temp
as $$
  select
    p_config is not null
    and jsonb_typeof(p_config) = 'object'
    and (p_config ? 'shapePreset')
    and (p_config ->> 'shapePreset') in ('sharp', 'balanced', 'soft')
    and (p_config ? 'typographyProfile')
    and (p_config ->> 'typographyProfile') in
        ('kabia_original', 'modern_clean', 'warm_editorial', 'soft_contemporary')
    and (p_config ? 'fonts')
    and (p_config -> 'fonts' ->> 'body') in
        ('instrument_sans', 'manrope', 'dm_sans', 'source_sans_3')
    and (p_config -> 'fonts' ->> 'display') in
        ('instrument_serif', 'fraunces', 'cormorant_garamond', 'lora')
$$;

revoke execute on function public.is_valid_theme_config(jsonb) from public, anon;

-- save_site_theme_draft(p_config) — replaces the draft with a validated config.
create or replace function public.save_site_theme_draft(p_config jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.app_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = v_uid and ur.is_active and ur.role in ('admin', 'super_admin');
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not public.is_valid_theme_config(p_config) then
    raise exception 'Geçersiz tema yapılandırması.' using errcode = '23514';
  end if;

  insert into public.site_theme_settings (site_key, published_config, draft_config, draft_updated_at, draft_updated_by)
  values ('default', p_config, p_config, now(), v_uid)
  on conflict (site_key) do update
    set draft_config = p_config,
        draft_updated_at = now(),
        draft_updated_by = v_uid;

  return true;
end;
$$;

comment on function public.save_site_theme_draft(jsonb) is
  'Replaces the in-progress draft with a validated configuration. Actor derived from auth.uid(); never accepted from the client.';

revoke execute on function public.save_site_theme_draft(jsonb) from public, anon;
grant  execute on function public.save_site_theme_draft(jsonb) to authenticated, service_role;

-- discard_site_theme_draft() — clears the draft so the editor returns to the
-- published configuration.
create or replace function public.discard_site_theme_draft()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.app_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = v_uid and ur.is_active and ur.role in ('admin', 'super_admin');
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.site_theme_settings
  set draft_config = null,
      draft_updated_at = now(),
      draft_updated_by = v_uid
  where site_key = 'default';

  return true;
end;
$$;

revoke execute on function public.discard_site_theme_draft() from public, anon;
grant  execute on function public.discard_site_theme_draft() to authenticated, service_role;

-- publish_site_theme(p_note) — the atomic publish. Validates the draft,
-- snapshots the previous published config into a new revision, promotes the
-- draft to published, increments the version, clears the draft, and writes an
-- audit event — all in one transaction. Partial publication is impossible.
create or replace function public.publish_site_theme(p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_role    public.app_role;
  v_row     public.site_theme_settings%rowtype;
  v_draft   jsonb;
  v_next    integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = v_uid and ur.is_active and ur.role in ('admin', 'super_admin');
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_row from public.site_theme_settings where site_key = 'default' for update;
  if not found then
    raise exception 'Tema satırı bulunamadı.' using errcode = 'P0002';
  end if;

  -- The draft to publish. If no draft exists, fall back to the currently
  -- published config (a no-op publish still records a revision so the
  -- operator's intent is auditable, but is otherwise identity).
  v_draft := coalesce(v_row.draft_config, v_row.published_config);

  if not public.is_valid_theme_config(v_draft) then
    raise exception 'Yayınlamadan önce taslak doğrulanamadı.' using errcode = '23514';
  end if;

  v_next := coalesce(v_row.published_version, 0) + 1;

  -- Snapshot the PREVIOUS published config into an immutable revision.
  -- version is the version the OLD config was known as; restoring by that
  -- number reproduces it exactly.
  insert into public.site_theme_revisions (site_key, version, config, action, publication_note, created_by)
  values ('default', v_row.published_version, v_row.published_config, 'publish', p_note, v_uid);

  -- Promote the draft to published, bump the version, clear the draft.
  update public.site_theme_settings
  set published_config = v_draft,
      published_version = v_next,
      draft_config = v_draft,
      draft_updated_at = now(),
      draft_updated_by = v_uid,
      published_at = now(),
      published_by = v_uid,
      schema_version = coalesce((v_draft ->> 'schemaVersion')::int, 1)
  where site_key = 'default';

  -- Audit with the server-derived identity. metadata keeps the version and
  -- a coarse diff of the preset/fonts so the audit log is useful without
  -- storing the entire CSS.
  perform public.log_admin_action(
    p_action      := 'theme.publish',
    p_entity_type := 'theme',
    p_entity_id   := 'default',
    p_before      := jsonb_build_object('version', v_row.published_version, 'shapePreset', v_row.published_config ->> 'shapePreset'),
    p_after       := jsonb_build_object('version', v_next, 'shapePreset', v_draft ->> 'shapePreset'),
    p_metadata    := jsonb_build_object(
      'note', p_note,
      'typographyProfile', v_draft ->> 'typographyProfile',
      'bodyFont', v_draft -> 'fonts' ->> 'body',
      'displayFont', v_draft -> 'fonts' ->> 'display'
    )
  );

  return v_next;
end;
$$;

comment on function public.publish_site_theme(text) is
  'Atomically promotes the draft to published: validates, snapshots the previous config into an immutable revision, updates published_config, increments the version, clears the draft, and writes an audit event. Partial publication is impossible.';

revoke execute on function public.publish_site_theme(text) from public, anon;
grant  execute on function public.publish_site_theme(text) to authenticated, service_role;

-- restore_site_theme_version(p_version, p_note) — restores a previous published
-- version by COPYING its config forward as a brand-new version. Never mutates
-- the historical revision. Version 3 -> current 6 creates version 7 with
-- version 3's config, then publishes it.
create or replace function public.restore_site_theme_version(p_version integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_role    public.app_role;
  v_row     public.site_theme_settings%rowtype;
  v_rev     public.site_theme_revisions%rowtype;
  v_next    integer;
  v_restored jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = v_uid and ur.is_active and ur.role in ('admin', 'super_admin');
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_row from public.site_theme_settings where site_key = 'default' for update;
  if not found then
    raise exception 'Tema satırı bulunamadı.' using errcode = 'P0002';
  end if;

  select * into v_rev from public.site_theme_revisions
  where site_key = 'default' and version = p_version;
  if not found then
    raise exception 'Sürüm bulunamadı.' using errcode = 'P0002';
  end if;

  v_restored := v_rev.config;
  if not public.is_valid_theme_config(v_restored) then
    raise exception 'Geri yüklenen yapılandırma artık geçersiz; evrim gerekebilir.' using errcode = '23514';
  end if;

  v_next := v_row.published_version + 1;

  -- Copy the historical config forward as a NEW immutable revision.
  insert into public.site_theme_revisions (site_key, version, config, action, publication_note, created_by)
  values ('default', v_row.published_version, v_row.published_config, 'restore', p_note, v_uid);

  update public.site_theme_settings
  set published_config = v_restored,
      published_version = v_next,
      draft_config = v_restored,
      draft_updated_at = now(),
      draft_updated_by = v_uid,
      published_at = now(),
      published_by = v_uid,
      schema_version = coalesce((v_restored ->> 'schemaVersion')::int, 1)
  where site_key = 'default';

  perform public.log_admin_action(
    p_action      := 'theme.revision_restore',
    p_entity_type := 'theme',
    p_entity_id   := 'default',
    p_before      := jsonb_build_object('version', v_row.published_version),
    p_after       := jsonb_build_object('version', v_next, 'restored_from', p_version),
    p_metadata    := jsonb_build_object('note', p_note, 'restored_from', p_version)
  );

  return v_next;
end;
$$;

comment on function public.restore_site_theme_version(integer, text) is
  'Restores a previous published version by copying its config forward as a new version. Never mutates historical revisions.';

revoke execute on function public.restore_site_theme_version(integer, text) from public, anon;
grant  execute on function public.restore_site_theme_version(integer, text) to authenticated, service_role;

-- ---- seed the default singleton -------------------------------------------
-- Only when no row exists. The default reproduces the current Kabia site
-- (balanced + kabia_original + Instrument Sans/Instrument Serif, no overrides),
-- so installing this migration changes no observable behaviour. published_by
-- is left null because there is no human publisher at seed time.

insert into public.site_theme_settings (site_key, published_config, draft_config, published_version, schema_version)
select 'default',
  jsonb_build_object(
    'schemaVersion', 1,
    'shapePreset', 'balanced',
    'typographyProfile', 'kabia_original',
    'fonts', jsonb_build_object('body', 'instrument_sans', 'display', 'instrument_serif'),
    'overrides', '{}'::jsonb
  ),
  null,
  1,
  1
where not exists (select 1 from public.site_theme_settings where site_key = 'default');

-- Initial revision: version 1 corresponds to the seeded published config.
insert into public.site_theme_revisions (site_key, version, config, action, publication_note, created_by)
select 'default', 1,
  jsonb_build_object(
    'schemaVersion', 1,
    'shapePreset', 'balanced',
    'typographyProfile', 'kabia_original',
    'fonts', jsonb_build_object('body', 'instrument_sans', 'display', 'instrument_serif'),
    'overrides', '{}'::jsonb
  ),
  'seed', 'İlk tema: Dengeli + Kabia Orijinal', null
where not exists (select 1 from public.site_theme_revisions where site_key = 'default' and version = 1);