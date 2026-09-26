-- ============================================================================
-- FEATURE 3 — müşteri zorunlu şifre değişikliği bayrağı
--
-- WHAT:
--   * profiles.must_change_password (boolean, NOT NULL DEFAULT false):
--     yönetici parola belirlediğinde true olur; müşteri şifresini
--     değiştirdiğinde customer_complete_password_change() ile temizlenir.
--   * guard_customer_password_flag(): must_change_password'a doğrudan yazımı
--     yasaklar; yalnızca işlem-yerel kabia.allow_password_flag_write bayrağını
--     kuran denetimli RPC'ler (aşağıdaki ikisi) yazabilir. Müşterinin bayrağı
--     PostgREST üzerinden sessizce temizlemesi böylece imkânsızdır.
--   * customer_complete_password_change(): kendi bayrağını temizler
--     (authenticated). Şifre değişimi ardından çağrılır.
--   * admin_set_customer_must_change(p_customer_id, p_value): gövde içinde
--     has_admin_role() denetler (authenticated). Yönetici parola adımları
--     bayrağı bununla kurar.
--
-- WHY: yönetici belirledi parolanın ilk girişte değiştirilmesi, sunucu
-- eylemlerinde zorlanır (yalnızca sayfada değil).
--
-- ROLLBACK: drop trigger + drop functions (sütun veri kaybı olmaması için
-- bırakılır).
-- ============================================================================

alter table public.profiles add column if not exists must_change_password boolean not null default false;

create or replace function public.guard_customer_password_flag()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.must_change_password is not distinct from new.must_change_password then
    return new;
  end if;
  if current_setting('kabia.allow_password_flag_write', true) = 'on' then
    return new;
  end if;
  raise exception 'Parola değişim bayrağı yalnızca denetimli işlemle değiştirilebilir.' using errcode = '42501';
end;
$function$;

drop trigger if exists trg_profiles_password_flag on public.profiles;
create trigger trg_profiles_password_flag
before update of must_change_password on public.profiles
for each row execute function public.guard_customer_password_flag();

revoke execute on function public.guard_customer_password_flag() from public, anon, authenticated;

-- Müşteri kendi bayrağını şifre değiştirdikten sonra temizler.
create or replace function public.customer_complete_password_change()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  perform set_config('kabia.allow_password_flag_write', 'on', true);
  update public.profiles set must_change_password = false where id = v_uid;
end;
$function$;

revoke execute on function public.customer_complete_password_change() from public, anon;
grant execute on function public.customer_complete_password_change() to authenticated, service_role;

-- Yönetici bir müşterinin bayrağını kurar/temizler (3b bunu true ile kullanır).
create or replace function public.admin_set_customer_must_change(p_customer_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.has_admin_role() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_customer_id is null then
    raise exception 'Müşteri seçilmedi.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id) then
    raise exception 'Müşteri bulunamadı.' using errcode = 'no_data_found';
  end if;
  perform set_config('kabia.allow_password_flag_write', 'on', true);
  update public.profiles set must_change_password = coalesce(p_value, true) where id = p_customer_id;
end;
$function$;

revoke execute on function public.admin_set_customer_must_change(uuid, boolean) from public, anon;
grant execute on function public.admin_set_customer_must_change(uuid, boolean) to authenticated, service_role;
