-- ============================================================================
-- Transactional e-posta bildirim kaydı (idempotency + admin görünürlüğü)
--
-- WHAT:
--   * public.email_notifications: her gönderilen (veya denenen) transactional
--     e-postanın tek satırlık kaydı —
--     order_id (sipariş e-postaları) veya yalnızca user_id (welcome),
--     kind, status, provider_message_id, error, sent_at, created_at.
--   * kind: welcome | order_received | order_shipped | order_delivered.
--     (order_cancelled öneri olarak raporda; bu tabloda kolonu yok, check'e
--     eklenerek büyütülebilir.)
--   * status: sending (hak kazanıldı, gönderim sürüyor) | sent | failed |
--     skipped (müşteri order_status tercihini kapatmış).
--   * Benzersizlik: kısmi unique index'ler —
--     uq_email_notifications_order_kind (order_id, kind) WHERE order_id NOT NULL,
--     uq_email_notifications_user_kind (user_id, kind) WHERE order_id IS NULL.
--     Her tür, sipariş başına en fazla bir kez "sent" olur; süper-yönetici
--     override'u ya da durum tekrarı ikinci gönderim yapamaz (uygulama önce
--     satır varsa durur; yarışta kaybeden INSERT 23505 yer ve durur).
--     Başarısız satırlar aynı satır üzerinden (koşullu UPDATE) yeniden
--     gönderilir; yeni satır açılmaz.
--   * RLS açık; müşteri yalnızca kendi satırlarını okur/yazar (sipariş
--     sahipliği with-check ile), yönetici has_admin_role() ile okur/yazar.
--     DELETE politikası yok (service_role hariç kimse silemez).
--   * notification_preferences.order_status canlıda zaten var (default true);
--     kargoda/teslim_edildi bu tercihe saygı gösterir, satır yoksa gönderir.
--
-- WHY: welcome / order-received / order-shipped / order-delivered şablonları
--   vardı ama hiçbir şey göndermiyordu; çift gönderim ve sessiz kayıp
--   kabul edilemez. Kayıt hem idempotency anahtarı hem admin panelindeki
--   "hangi e-posta ne zaman gitti / başarısız olanı yeniden gönder" kaynağı.
--
-- IDEMPOTENT: if-not-exists tablo/index/policy; revoke/grant tekrarlanabilir.
--
-- ROLLBACK: drop table if exists public.email_notifications;
-- ============================================================================

create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null
    check (kind in ('welcome', 'order_received', 'order_shipped', 'order_delivered')),
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'skipped')),
  provider_message_id text
    check (provider_message_id is null or char_length(provider_message_id) <= 200),
  error text
    check (error is null or char_length(error) <= 2000),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_notifications_shape check (
    (kind = 'welcome' and order_id is null and user_id is not null)
    or (kind in ('order_received', 'order_shipped', 'order_delivered')
        and order_id is not null and user_id is not null)
  )
);

create unique index if not exists uq_email_notifications_order_kind
  on public.email_notifications (order_id, kind)
  where order_id is not null;

create unique index if not exists uq_email_notifications_user_kind
  on public.email_notifications (user_id, kind)
  where order_id is null;

create index if not exists idx_email_notifications_order
  on public.email_notifications (order_id, created_at desc);

create index if not exists idx_email_notifications_user
  on public.email_notifications (user_id, created_at desc);

alter table public.email_notifications enable row level security;

revoke all on table public.email_notifications from public, anon;
grant select, insert, update on table public.email_notifications to authenticated;
grant all on table public.email_notifications to service_role;

-- ---- owner-scoped (müşteri kendi satırları) --------------------------------

drop policy if exists en_select_own on public.email_notifications;
create policy en_select_own on public.email_notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists en_insert_own on public.email_notifications;
create policy en_insert_own on public.email_notifications
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      order_id is null
      or order_id in (select o.id from public.orders o where o.user_id = (select auth.uid()))
    )
  );

drop policy if exists en_update_own on public.email_notifications;
create policy en_update_own on public.email_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      order_id is null
      or order_id in (select o.id from public.orders o where o.user_id = (select auth.uid()))
    )
  );

-- ---- admin (sipariş yönetimi) ------------------------------------------------

drop policy if exists en_select_admin on public.email_notifications;
create policy en_select_admin on public.email_notifications
  for select to authenticated
  using (public.has_admin_role());

drop policy if exists en_insert_admin on public.email_notifications;
create policy en_insert_admin on public.email_notifications
  for insert to authenticated
  with check (public.has_admin_role());

drop policy if exists en_update_admin on public.email_notifications;
create policy en_update_admin on public.email_notifications
  for update to authenticated
  using (public.has_admin_role())
  with check (public.has_admin_role());

notify pgrst, 'reload schema';
