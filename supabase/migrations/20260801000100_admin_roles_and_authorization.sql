-- ---------------------------------------------------------------------------
-- Database-backed role model for the Kabia admin dashboard.
--
-- Roles live in a table, not in JWT claims. Supabase `user_metadata` is
-- user-editable and `app_metadata` claims are stale until a token refresh, so
-- neither is safe as the final authorization boundary. Every check reads this
-- table.
--
-- Rollback: drop the trigger, the four helper functions, the table, then the
-- enum. Nothing outside the admin surface depends on any of it, and no existing
-- policy is modified by this migration.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role' and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('customer', 'admin', 'super_admin');
  end if;
end $$;

create table if not exists public.user_roles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  role                 public.app_role not null,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) on delete set null
);

comment on table public.user_roles is
  'Authoritative role assignment. Absence of a row means "customer". Only rows with is_active = true grant access. Writable only by super_admin, enforced by RLS.';
comment on column public.user_roles.must_change_password is
  'Set on bootstrap accounts. The protected admin layout refuses to render anything but the password-change screen while this is true.';

create index if not exists idx_user_roles_active_role
  on public.user_roles (role) where is_active;

-- ---- authorization helpers -------------------------------------------------
-- SECURITY DEFINER so that a policy on another table can ask "is this caller an
-- admin?" without re-entering RLS on user_roles. They read one row and return a
-- boolean or an enum; no row data escapes. search_path is pinned and EXECUTE is
-- revoked from PUBLIC and anon.

create or replace function public.current_admin_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.is_active
    and ur.role in ('admin', 'super_admin')
$$;

create or replace function public.has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_admin_role() is not null
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_admin_role() = 'super_admin'
$$;

create or replace function public.authorize_admin(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case required
    when 'super_admin' then public.current_admin_role() = 'super_admin'
    when 'admin'       then public.current_admin_role() in ('admin', 'super_admin')
    else false
  end
$$;

comment on function public.authorize_admin(public.app_role) is
  'True when the caller holds at least the required administrative role. "customer" is never an administrative requirement and always returns false.';

revoke execute on function public.current_admin_role()                 from public, anon;
revoke execute on function public.has_admin_role()                     from public, anon;
revoke execute on function public.is_super_admin()                     from public, anon;
revoke execute on function public.authorize_admin(public.app_role)     from public, anon;

grant execute on function public.current_admin_role()             to authenticated, service_role;
grant execute on function public.has_admin_role()                 to authenticated, service_role;
grant execute on function public.is_super_admin()                 to authenticated, service_role;
grant execute on function public.authorize_admin(public.app_role) to authenticated, service_role;

-- ---- the last-super-admin invariant ----------------------------------------
-- Holds against direct SQL, not just against the UI.

create or replace function public.enforce_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining int;
begin
  -- Only guard transitions that actually remove an active super_admin.
  if tg_op = 'DELETE' then
    if old.role <> 'super_admin' or not old.is_active then
      return old;
    end if;
  else
    if old.role <> 'super_admin' or not old.is_active then
      return new;
    end if;
    if new.role = 'super_admin' and new.is_active then
      return new;
    end if;
  end if;

  select count(*) into v_remaining
  from public.user_roles
  where role = 'super_admin'
    and is_active
    and user_id <> old.user_id;

  if v_remaining = 0 then
    raise exception 'Son aktif süper yönetici kaldırılamaz veya yetkisi düşürülemez.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_roles_last_super_admin on public.user_roles;
create trigger trg_user_roles_last_super_admin
before update or delete on public.user_roles
for each row execute function public.enforce_last_super_admin();

create or replace function public.touch_user_roles_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_roles_touch on public.user_roles;
create trigger trg_user_roles_touch
before update on public.user_roles
for each row execute function public.touch_user_roles_updated_at();

revoke execute on function public.enforce_last_super_admin()      from public, anon, authenticated;
revoke execute on function public.touch_user_roles_updated_at()   from public, anon, authenticated;

-- ---- RLS -------------------------------------------------------------------
-- A plain `admin` has no write access here at all, which is a stronger
-- guarantee than "an admin may not assign super_admin".

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_own        on public.user_roles;
drop policy if exists user_roles_select_admin      on public.user_roles;
drop policy if exists user_roles_write_super_admin on public.user_roles;

create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_roles_select_admin on public.user_roles
  for select to authenticated
  using (public.has_admin_role());

create policy user_roles_write_super_admin on public.user_roles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

revoke all on public.user_roles from anon;
grant select, insert, update, delete on public.user_roles to authenticated;
