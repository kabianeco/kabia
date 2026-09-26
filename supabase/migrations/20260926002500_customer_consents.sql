-- ============================================================================
-- Phase 2 — registration consents recorded server-side; campaign e-mail is
-- opt-in everywhere.
--
-- WHAT:
--   1. public.customer_consents: append-only consent log (terms, kvkk,
--      marketing_email), with the document version and the server's clock.
--      RLS on; customers may only SELECT their own rows; nobody but
--      SECURITY DEFINER code (below) writes. Rows follow the profile
--      (ON DELETE CASCADE) when an account is deleted.
--   2. notification_preferences.campaign_emails DEFAULT false (was true).
--      Existing rows are NOT modified by this migration (2 rows, both true
--      from the old default; reported to the owner).
--   3. handle_new_user(): unchanged profile/cart inserts; additionally reads
--      raw_user_meta_data->'consents' written by the registration server
--      action (which rejects sign-up unless terms and KVKK are accepted):
--        {"terms": "<version>", "kvkk": "<version>", "marketing": true|false,
--         "explicit_consent": "<version>"}
--      and records one row per present consent. campaign_emails starts as the
--      marketing choice, false when absent (e.g. OAuth sign-up).
--   4. public.set_marketing_email_consent(p_granted boolean): the only way a
--      signed-in customer changes campaign e-mail. Updates the preference and
--      logs a consent row when the value actually changes, atomically.
--      EXECUTE for authenticated and service_role only.
--
-- WHY: the registration form only checked the consents in the browser, the
--   marketing choice was never stored, and campaign e-mail defaulted to on.
--
-- IDEMPOTENT: if-not-exists / create or replace / drop-if-exists policy;
--   grants and revokes repeatable.
--
-- ROLLBACK:
--   drop function if exists public.set_marketing_email_consent(boolean);
--   alter table public.notification_preferences alter column campaign_emails set default true;
--   restore handle_new_user() from
--   /Users/mustafa/kabia-maturity-pass/db-snapshots/20260926T-phase2-06-consents-pre.sql
--   drop table if exists public.customer_consents;  -- only if the log may be discarded
-- ============================================================================

create table if not exists public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('terms', 'kvkk', 'marketing_email')),
  granted boolean not null,
  document_version text check (document_version is null or char_length(document_version) <= 40),
  source text not null check (source in ('registration', 'account_settings')),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_customer_consents_user_kind
  on public.customer_consents (user_id, kind, recorded_at desc);

alter table public.customer_consents enable row level security;

revoke all on table public.customer_consents from anon, authenticated;
grant select on table public.customer_consents to authenticated;
grant all on table public.customer_consents to service_role;

drop policy if exists consents_select_own on public.customer_consents;
create policy consents_select_own on public.customer_consents
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.notification_preferences alter column campaign_emails set default false;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_consents jsonb := case when jsonb_typeof(new.raw_user_meta_data->'consents') = 'object'
                           then new.raw_user_meta_data->'consents' else '{}'::jsonb end;
  v_marketing boolean := (v_consents->>'marketing') = 'true';
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id, campaign_emails)
  values (new.id, v_marketing)
  on conflict (user_id) do nothing;

  insert into public.carts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  if coalesce(v_consents->>'terms', '') <> '' then
    insert into public.customer_consents (user_id, kind, granted, document_version, source)
    values (new.id, 'terms', true, left(v_consents->>'terms', 40), 'registration');
  end if;
  if coalesce(v_consents->>'kvkk', '') <> '' then
    insert into public.customer_consents (user_id, kind, granted, document_version, source)
    values (new.id, 'kvkk', true, left(v_consents->>'kvkk', 40), 'registration');
  end if;
  if v_consents ? 'marketing' then
    insert into public.customer_consents (user_id, kind, granted, document_version, source)
    values (new.id, 'marketing_email', v_marketing, left(v_consents->>'explicit_consent', 40), 'registration');
  end if;

  return new;
end;
$function$;

create or replace function public.set_marketing_email_consent(p_granted boolean)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_previous boolean;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_granted is null then raise exception 'Geçersiz tercih.' using errcode = '22023'; end if;
  select campaign_emails into v_previous from public.notification_preferences where user_id = v_uid for update;
  insert into public.notification_preferences (user_id, campaign_emails) values (v_uid, p_granted)
    on conflict (user_id) do update set campaign_emails = excluded.campaign_emails;
  if v_previous is distinct from p_granted then
    insert into public.customer_consents (user_id, kind, granted, source)
    values (v_uid, 'marketing_email', p_granted, 'account_settings');
  end if;
  return p_granted;
end;
$function$;

revoke all on function public.set_marketing_email_consent(boolean) from public, anon;
grant execute on function public.set_marketing_email_consent(boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
