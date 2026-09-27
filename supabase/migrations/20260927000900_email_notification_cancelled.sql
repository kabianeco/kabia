-- ============================================================================
-- Transactional iptal e-postası: email_notifications.kind += order_cancelled
--
-- WHAT:
--   * public.email_notifications üzerindeki iki CHECK kısıtını genişletir:
--     - email_notifications_kind_check: order_cancelled eklenir.
--     - email_notifications_shape: siparişe bağlı türlere order_cancelled
--       eklenir (order_id + user_id zorunlu, welcome dışı).
--   * Kısıt adları korunur (drop + add with same names); index'ler, RLS,
--     status değerleri ve diğer kolonlar değişmez.
--   * İptal e-postası transactional'dır: order-received gibi tercihten
--     bağımsız her zaman gönderilir; order_status=false yalnızca
--     shipped/delivered türlerini durdurur.
--
-- WHY: iptal (iptal_edildi) restock'u vardı ama müşteriye giden bir iptal
--   bildirimi yoktu. Kayıt idempotency anahtarıdır: durum aksiyonu ve
--   süper-yönetici override'u aynı satırı claim eder, ikinci gönderim
--   olamaz; başarısız satır admin detayından yeniden gönderilir.
--
-- IDEMPOTENT: kısıt varsa düşürüp yeniden kurar; tekrar çalıştırılabilir.
--   Mevcut satırlar (welcome/order_received/order_shipped/order_delivered)
--   yeni CHECK'i de sağlar, veri değişmez.
--
-- ROLLBACK:
--   alter table public.email_notifications drop constraint if exists
--     email_notifications_kind_check;
--   alter table public.email_notifications add constraint
--     email_notifications_kind_check check (kind in ('welcome',
--     'order_received', 'order_shipped', 'order_delivered'));
--   alter table public.email_notifications drop constraint if exists
--     email_notifications_shape;
--   alter table public.email_notifications add constraint
--     email_notifications_shape check (
--     (kind = 'welcome' and order_id is null and user_id is not null)
--     or (kind in ('order_received', 'order_shipped', 'order_delivered')
--         and order_id is not null and user_id is not null));
-- ============================================================================

alter table public.email_notifications
  drop constraint if exists email_notifications_kind_check;
alter table public.email_notifications
  add constraint email_notifications_kind_check
  check (kind in ('welcome', 'order_received', 'order_shipped', 'order_delivered', 'order_cancelled'));

alter table public.email_notifications
  drop constraint if exists email_notifications_shape;
alter table public.email_notifications
  add constraint email_notifications_shape check (
    (kind = 'welcome' and order_id is null and user_id is not null)
    or (kind in ('order_received', 'order_shipped', 'order_delivered', 'order_cancelled')
        and order_id is not null and user_id is not null)
  );

notify pgrst, 'reload schema';
