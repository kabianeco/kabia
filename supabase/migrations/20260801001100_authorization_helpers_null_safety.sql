-- ---------------------------------------------------------------------------
-- Null-safety fix for the authorization helpers.
--
-- Found by the adversarial authorization probe run after 20260801001000:
-- for a signed-in customer, current_admin_role() is NULL, so
-- `current_admin_role() = 'super_admin'` evaluated to NULL rather than false.
--
-- Inside an RLS USING clause that is harmless — Postgres treats NULL as
-- "no rows" — but the same functions are read by application code and by other
-- SQL, where a three-valued result is a trap waiting to be `!== false`-checked
-- into an authorization bypass. Both functions now return a strict boolean.
--
-- has_admin_role() was already null-safe (`IS NULL` never returns NULL).
--
-- Rollback: restore the previous bodies from 20260801000100.
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_admin_role() = 'super_admin', false)
$$;

create or replace function public.authorize_admin(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    case required
      when 'super_admin' then public.current_admin_role() = 'super_admin'
      when 'admin'       then public.current_admin_role() in ('admin', 'super_admin')
      else false
    end,
    false
  )
$$;

revoke execute on function public.is_super_admin()                 from public, anon;
revoke execute on function public.authorize_admin(public.app_role) from public, anon;
grant  execute on function public.is_super_admin()                 to authenticated, service_role;
grant  execute on function public.authorize_admin(public.app_role) to authenticated, service_role;
