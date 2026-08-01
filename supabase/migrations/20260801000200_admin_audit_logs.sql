-- ---------------------------------------------------------------------------
-- Immutable administrative audit trail.
--
-- Rows can only be written through log_admin_action(), which derives the acting
-- administrator from auth.uid(). A client-supplied administrator id is
-- structurally impossible. There is no INSERT/UPDATE/DELETE policy on the
-- table, and a trigger raises on UPDATE or DELETE so immutability survives a
-- future policy mistake.
--
-- admin_user_id deliberately has no foreign key: this is a historical record,
-- in the same spirit as the product snapshots on order_items. Deleting an auth
-- user must not be able to rewrite or block the log.
--
-- Rollback: drop the triggers, the table, then log_admin_action() and
-- redact_audit_payload(). Dropping the immutability trigger is a deliberate,
-- auditable act — it is the only way to ever mutate this table.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_role    text not null,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.admin_audit_logs is
  'Append-only administrative audit trail. Written only by public.log_admin_action(). Never stores credentials, tokens or card data.';

create index if not exists idx_admin_audit_created_at on public.admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_admin      on public.admin_audit_logs (admin_user_id, created_at desc);
create index if not exists idx_admin_audit_entity     on public.admin_audit_logs (entity_type, entity_id);
create index if not exists idx_admin_audit_action     on public.admin_audit_logs (action);

-- ---- redaction -------------------------------------------------------------
-- Defence in depth. Callers are not supposed to pass secrets, and this makes a
-- mistake non-fatal.

create or replace function public.redact_audit_payload(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_temp
as $$
declare
  v_out jsonb;
  v_key text;
  v_val jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return p;
  end if;

  v_out := '{}'::jsonb;
  for v_key, v_val in select * from jsonb_each(p) loop
    if v_key ~* '(password|passwd|secret|token|api[_-]?key|service[_-]?role|anon[_-]?key|cvv|cvc|card[_-]?number|pan|authorization|bearer)' then
      v_out := v_out || jsonb_build_object(v_key, '[redacted]');
    else
      v_out := v_out || jsonb_build_object(v_key, v_val);
    end if;
  end loop;

  return v_out;
end;
$$;

create or replace function public.log_admin_action(
  p_action      text,
  p_entity_type text,
  p_entity_id   text  default null,
  p_before      jsonb default null,
  p_after       jsonb default null,
  p_metadata    jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_role public.app_role;
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = v_uid
    and ur.is_active
    and ur.role in ('admin', 'super_admin');

  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, admin_role, action, entity_type, entity_id,
    before_data, after_data, metadata
  )
  values (
    v_uid, v_role::text, p_action, p_entity_type, p_entity_id,
    public.redact_audit_payload(p_before),
    public.redact_audit_payload(p_after),
    public.redact_audit_payload(p_metadata)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.log_admin_action(text, text, text, jsonb, jsonb, jsonb) is
  'The only write path into admin_audit_logs. Derives the administrator identity and role from the session, never from arguments.';

revoke execute on function public.redact_audit_payload(jsonb) from public, anon;
revoke execute on function public.log_admin_action(text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.log_admin_action(text, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- ---- immutability ----------------------------------------------------------

create or replace function public.deny_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_temp
as $$
begin
  raise exception 'public.admin_audit_logs is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists trg_admin_audit_immutable on public.admin_audit_logs;
create trigger trg_admin_audit_immutable
before update or delete on public.admin_audit_logs
for each row execute function public.deny_audit_mutation();

revoke execute on function public.deny_audit_mutation() from public, anon, authenticated;

-- ---- RLS -------------------------------------------------------------------

alter table public.admin_audit_logs enable row level security;

drop policy if exists audit_select_super_admin on public.admin_audit_logs;
drop policy if exists audit_select_own         on public.admin_audit_logs;

create policy audit_select_super_admin on public.admin_audit_logs
  for select to authenticated
  using (public.is_super_admin());

create policy audit_select_own on public.admin_audit_logs
  for select to authenticated
  using (public.has_admin_role() and admin_user_id = (select auth.uid()));

-- No INSERT/UPDATE/DELETE policy exists, and the grants match: the table is
-- readable through RLS and writable only through the definer function.
revoke all on public.admin_audit_logs from anon, authenticated;
grant select on public.admin_audit_logs to authenticated;
