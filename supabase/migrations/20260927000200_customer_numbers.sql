-- ============================================================================
-- FEATURE 1 — müşteri numaraları (KE-######)
--
-- WHAT:
--   * profiles.customer_number eklendi: 'KE-' + 6 rastgele rakam, unique,
--     format CHECK'li, NOT NULL, immutable (update'te değişirse hata).
--   * public.generate_customer_number(): rastgele aday üretip profiles'ta
--     çakışma yoksa döner; yalnızca trigger/backfill yolundan çağrılır.
--   * handle_new_user(): profil satırı oluşturulurken numarayı aynı yerde
--     atar (on conflict durumunda mevcut satır korunur, numara backfill'de gelir).
--   * Backfill: numarasız her profile tek tek numara atanır.
--   * admin_customer_overview: customer_number sütunu eklendi (security_invoker
--     aynen korunur; müşteri yalnızca kendi satırını görür).
--   * Immutable guard: trg_profiles_customer_number_immutable.
--
-- WHY: her müşteriye sayaç belli etmeyen rastgele numara; kayıtta otomatik,
-- mevcutlara backfill; müşteri kendi hesabında, admin liste+detayda görür.
--
-- ROLLBACK: drop trigger/view değişikliği geri alınır, sütun bırakılır
-- (veri kaybı olmaması için DROP COLUMN yapılmaz):
--   drop trigger if exists trg_profiles_customer_number_immutable on public.profiles;
--   drop function if exists public.guard_customer_number_immutable();
--   ... admin_customer_overview önceki tanıma döndürülür ...
-- (customer_number sütunu ve verisi korunur.)
-- ============================================================================

alter table public.profiles add column if not exists customer_number text;

-- Rastgele, çakışmasız numara üretici (trigger-only; doğrudan çağrıya kapalı).
create or replace function public.generate_customer_number()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_candidate text;
  v_tries int := 0;
begin
  loop
    v_candidate := 'KE-' || lpad(floor(random() * 1000000)::int::text, 6, '0');
    if not exists (select 1 from public.profiles where customer_number = v_candidate) then
      return v_candidate;
    end if;
    v_tries := v_tries + 1;
    if v_tries > 50 then
      raise exception 'Müşteri numarası üretilemedi.' using errcode = '55000';
    end if;
  end loop;
end;
$function$;

revoke execute on function public.generate_customer_number() from public, anon, authenticated;

-- Kayıt anında aynı yerde ata (mevcut handle_new_user gövdesi + numara).
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
  insert into public.profiles (id, full_name, phone, customer_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    public.generate_customer_number()
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

-- Backfill: numarasız her profile tek tek ata.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where customer_number is null loop
    update public.profiles
    set customer_number = public.generate_customer_number()
    where id = r.id;
  end loop;
end $$;

-- Biçim + benzersizlik + zorunluluk.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_customer_number_format') then
    alter table public.profiles add constraint profiles_customer_number_format
      check (customer_number ~ '^KE-[0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_customer_number_key') then
    alter table public.profiles add constraint profiles_customer_number_key unique (customer_number);
  end if;
end $$;

alter table public.profiles alter column customer_number set not null;

-- Immutable guard.
create or replace function public.guard_customer_number_immutable()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.customer_number is distinct from new.customer_number then
    raise exception 'Müşteri numarası değiştirilemez.' using errcode = '25001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_profiles_customer_number_immutable on public.profiles;
create trigger trg_profiles_customer_number_immutable
before update of customer_number on public.profiles
for each row execute function public.guard_customer_number_immutable();

revoke execute on function public.guard_customer_number_immutable() from public, anon, authenticated;

-- Admin listesi/detayı için read model'e ekle (security_invoker korunur).
-- Not: sütun ortaya eklendiği için CREATE OR REPLACE yetmez (42P16);
-- DROP + CREATE kullanılır, grant'ler aynen geri verilir.
drop view if exists public.admin_customer_overview;
create view public.admin_customer_overview
with (security_invoker = true) as
select
  pr.id,
  pr.full_name,
  pr.phone,
  pr.customer_number,
  pr.created_at,
  count(o.id) filter (where o.status <> 'iptal_edildi')::int          as order_count,
  count(o.id) filter (where o.status = 'iptal_edildi')::int           as cancelled_count,
  coalesce(sum(o.total) filter (where o.status <> 'iptal_edildi'), 0) as total_spent,
  max(o.created_at)                                                   as last_order_at
from public.profiles pr
left join public.orders o on o.user_id = pr.id
group by pr.id;

revoke all on public.admin_customer_overview from anon, authenticated;
grant select on public.admin_customer_overview to authenticated;
