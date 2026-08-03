-- ---------------------------------------------------------------------------
-- Follow-up to 20260801200000_theme_engine: correct the revision insert model.
--
-- Bug: the original publish/restore RPCs inserted the revision row with the
-- OLD published_version and the OLD config. That collided with the seed
-- revision (version 1) on the first publish:
--   `duplicate key value violates unique constraint site_theme_revisions_site_version_uniq`
--
-- The consistent model (spec §38: "Restoring version 3 while current is 6 must
-- create a new version 7 containing version 3's configuration") is that a
-- revision row with `version = N` holds the configuration that was published
-- AS version N. So:
--   * publish creates a revision for `v_next` holding the *newly promoted* draft;
--   * restore creates a revision for `v_next` holding the *restored* historical
--     config.
-- The previous published config is already preserved in the revision history
-- under its own version number (the seed inserted version 1, every prior
-- publish inserted its v_next), so no separate "snapshot of previous" insert
-- is needed. Audit metadata still records before/after for traceability.
--
-- Rollback: restore the previous function bodies from 20260801200000.
-- ---------------------------------------------------------------------------

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

  v_draft := coalesce(v_row.draft_config, v_row.published_config);

  if not public.is_valid_theme_config(v_draft) then
    raise exception 'Yayınlamadan önce taslak doğrulanamadı.' using errcode = '23514';
  end if;

  v_next := coalesce(v_row.published_version, 0) + 1;

  -- The new published version's immutable revision. The previous published
  -- config is already preserved in the history under its own version number.
  insert into public.site_theme_revisions (site_key, version, config, action, publication_note, created_by)
  values ('default', v_next, v_draft, 'publish', p_note, v_uid)
  on conflict (site_key, version) do nothing;

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
  'Atomically promotes the draft to published: validates, writes an immutable revision for the new version holding the promoted config, updates published_config, increments the version, clears the draft, and writes an audit event. Partial publication is impossible.';

revoke execute on function public.publish_site_theme(text) from public, anon;
grant  execute on function public.publish_site_theme(text) to authenticated, service_role;

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

  -- Copy the historical config forward as a NEW immutable version. The
  -- historical revision (p_version) is never mutated.
  insert into public.site_theme_revisions (site_key, version, config, action, publication_note, created_by)
  values ('default', v_next, v_restored, 'restore', p_note, v_uid);

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