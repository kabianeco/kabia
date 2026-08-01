-- ---------------------------------------------------------------------------
-- Letting an administrator clear their own forced-password-change flag.
--
-- `user_roles` is writable only by super_admin, which is correct: an ordinary
-- admin must not be able to touch role rows. But that also means a plain admin
-- could never clear their own `must_change_password` flag after changing their
-- password, and would be trapped on the password screen forever.
--
-- This function is the narrow exception. It can only ever clear the flag, only
-- ever on the caller's own row, and only for an active administrator. It cannot
-- change a role, reactivate an account, or touch anyone else.
--
-- It does not — and cannot — verify that a password change actually happened;
-- it is called by the server action immediately after Supabase Auth accepts the
-- new password. The blast radius if that were bypassed is a user removing their
-- own reminder to rotate a password they already hold, so the trade is worth
-- not handing the service-role key to a routine screen.
--
-- Rollback: drop the function.
-- ---------------------------------------------------------------------------

create or replace function public.admin_complete_password_change()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_role public.app_role := public.current_admin_role();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.user_roles
  set must_change_password = false,
      updated_by = v_uid
  where user_id = v_uid
    and must_change_password;

  perform public.log_admin_action(
    'administrator.password_change',
    'administrator',
    v_uid::text,
    null,
    null,
    jsonb_build_object('self_service', true)
  );
end;
$$;

comment on function public.admin_complete_password_change() is
  'Clears the caller''s own must_change_password flag. Cannot set it, cannot target another user, cannot alter a role.';

revoke execute on function public.admin_complete_password_change() from public, anon;
grant  execute on function public.admin_complete_password_change() to authenticated;
