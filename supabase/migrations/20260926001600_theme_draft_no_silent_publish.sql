-- ============================================================================
-- S28 (theme draft first insert seeds published_config without revision or
-- audit): the seed row becomes the only creator.
--
-- WHAT: save_site_theme_draft() re-created with the upsert replaced by an
-- update-first write: if no site_key='default' row exists it raises P0002
-- instead of publishing the unreviewed draft by side effect
-- (published_config := p_config with no site_theme_revisions row and no
-- log_admin_action call). Mirrors publish/restore's missing-row raise.
-- The migration seed remains the sole insert path, so the invariant "every
-- published_config value has a revision row" holds by construction.
-- Signature, grants and validation unchanged.
--
-- ROLLBACK: restore the upsert body from
-- supabase/migrations/20260801200000_theme_engine.sql (lines ~232-237).
--
-- BACKWARD COMPATIBILITY: the singleton row exists live (seeded); the
-- missing-row branch is unreachable in normal operation and only converts a
-- silent mispublish into a loud, safe error on a fresh/row-deleted database.
-- Deployed draft saves bind the same signature and hit the update branch.
-- ============================================================================

create or replace function public.save_site_theme_draft(p_config jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- S28: never create the singleton row from a draft save — creating it here
  -- would publish the unreviewed draft with no revision and no audit. The
  -- migration seed owns creation (with its matching v1 revision row).
  update public.site_theme_settings
  set draft_config = p_config,
      draft_updated_at = now(),
      draft_updated_by = v_uid
  where site_key = 'default';

  if not found then
    raise exception 'Tema satırı bulunamadı.' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;
