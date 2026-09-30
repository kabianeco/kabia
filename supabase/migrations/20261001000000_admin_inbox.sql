-- ---------------------------------------------------------------------------
-- Admin e-posta kutusu (gelen + gönderilen): başlıklar, iletiler, ekler.
--
-- WHAT: `email_threads` (konuşma), `emails` (her yöndeki ileti) ve
--   `email_attachments` (ek üstverisi + Storage yolu) tabloları ile eklerin
--   duracağı özel `email-attachments` Storage bucket'ı.
-- WHY: Resend alım (receiving) webhook'uyla `info@kabiaekolojik.com` adresine
--   gelen e-postalar ile panelden yazılan yanıtlar/yeni iletiler tek modelde
--   tutulur; ekler asla herkese açık `product-media` bucket'ına yazılmaz.
--
-- Tasarım kararları:
--   * `resend_id` (kısmi unique): webhook tekrar gönderiminde (redelivery)
--     ikinci satır açılamaz — idempotency anahtarı budur.
--   * Gelen gövde çekilemezse satır `fetch_status='failed'` + `fetch_error`
--     ile durur; sessiz düşme yok, panelden "yeniden dene" var.
--   * Silme yumuşaktır (`is_deleted`); tabloda DELETE politikası bilerek yok
--     (contact_messages emsali). KVKK kesin silme, ayrı migration + süper
--     yönetici akışıyla gelecek; otomatik tasfiye kurulmadı.
--   * RLS: yalnızca admin rolleri (has_admin_role). Webhook yazımı service
--     role ile yapılır (contact_messages emsali); anon'un grant'i yok.
--
-- Rollback: politikaları düşür, tabloları düşür (sırayla attachments,
--   emails, threads), bucket'ı boşaltıp sil. Veri geri gelmez — rollback
--   yalnızca hiç gerçek ileti alınmadan önce anlamlıdır.
-- ---------------------------------------------------------------------------

-- ---- konuşmalar ------------------------------------------------------------

create table if not exists public.email_threads (
  id              uuid        primary key default gen_random_uuid(),
  subject         text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

comment on table public.email_threads is
  'E-posta konuşmaları. Message-ID / In-Reply-To / References zinciriyle birleşir; uygulama kodu eşleştirir.';

create index if not exists idx_email_threads_last_message_at
  on public.email_threads (last_message_at desc);

-- ---- iletiler --------------------------------------------------------------

create table if not exists public.emails (
  id                 uuid        primary key default gen_random_uuid(),
  thread_id          uuid        not null references public.email_threads (id) on delete restrict,
  direction          text        not null
    check (direction in ('inbound', 'outbound')),
  -- Resend kimliği: gelen için receiving id, giden için send id.
  -- Gelen satırda boş olamaz; boşken unique uygulanmaz (kısmi index).
  resend_id          text,
  from_address       text        not null,
  from_name          text,
  to_addresses       text[]      not null default '{}',
  cc_addresses       text[]      not null default '{}',
  bcc_addresses      text[]      not null default '{}',
  reply_to_addresses text[]      not null default '{}',
  subject            text        not null default '',
  body_text          text,
  body_html          text,
  headers            jsonb       not null default '{}',
  message_id         text,
  in_reply_to        text,
  references_text    text,
  -- Resend Receiving API'nin sunucu taraflı hesapladığı sonuçlar; başlıktan
  -- okunmaz, gönderen tarafından uydurulamaz. Eski iletilerde null olabilir.
  auth_spf           text
    check (auth_spf is null or auth_spf in ('pass', 'fail', 'gray', 'processing_failed', 'unknown')),
  auth_dkim          text
    check (auth_dkim is null or auth_dkim in ('pass', 'fail', 'gray', 'processing_failed', 'unknown')),
  auth_dmarc         text
    check (auth_dmarc is null or auth_dmarc in ('pass', 'fail', 'gray', 'processing_failed', 'unknown')),
  -- Gelen gövde çekme durumu: 'failed' + fetch_error = panelden yeniden dene.
  fetch_status       text        not null default 'ok'
    check (fetch_status in ('ok', 'failed')),
  fetch_error        text,
  is_read            boolean     not null default false,
  read_at            timestamptz,
  is_archived        boolean     not null default false,
  archived_at        timestamptz,
  is_deleted         boolean     not null default false,
  deleted_at         timestamptz,
  -- Giden iletide yazan yönetici (media_assets.created_by emsali).
  sent_by            uuid        references auth.users (id) on delete set null,
  received_at        timestamptz,
  sent_at            timestamptz,
  created_at         timestamptz not null default now(),

  constraint emails_inbound_requires_resend_id
    check (direction = 'outbound' or resend_id is not null),
  -- read_at ↔ is_read birlikte hareket eder (contact_messages emsali).
  constraint emails_read_at_matches_flag
    check (is_read = (read_at is not null)),
  constraint emails_archived_at_matches_flag
    check (is_archived = (archived_at is not null)),
  constraint emails_deleted_at_matches_flag
    check (is_deleted = (deleted_at is not null))
);

comment on table public.emails is
  'Admin e-posta kutusu: gelen (Resend receiving) ve giden (panelden yazılan) iletiler. Silme yumuşaktır; DELETE politikası yok.';
comment on column public.emails.resend_id is
  'Idempotency anahtarı: webhook redelivery aynı id ile ikinci satır açamaz (kısmi unique index).';
comment on column public.emails.fetch_status is
  'failed = gövde Resend API''den çekilemedi; fetch_error ile birlikte yeniden deneme bekler.';

create unique index if not exists uq_emails_resend_id
  on public.emails (resend_id) where resend_id is not null;

create index if not exists idx_emails_thread_created
  on public.emails (thread_id, created_at asc);

create index if not exists idx_emails_inbox
  on public.emails (direction, created_at desc)
  where is_deleted = false;

create index if not exists idx_emails_message_id
  on public.emails (message_id) where message_id is not null;

-- ---- ekler -----------------------------------------------------------------

create table if not exists public.email_attachments (
  id                   uuid    primary key default gen_random_uuid(),
  email_id             uuid    not null references public.emails (id) on delete cascade,
  resend_attachment_id text,
  filename             text    not null,
  content_type         text    not null default 'application/octet-stream',
  size_bytes           bigint  check (size_bytes is null or size_bytes > 0),
  content_disposition  text,
  content_id           text,
  storage_bucket       text    not null default 'email-attachments',
  -- İndirilip Storage'a yazılana kadar null; hata varsa fetch_error dolar.
  storage_path         text,
  fetch_error          text,
  created_at           timestamptz not null default now()
);

comment on table public.email_attachments is
  'İleti eklerinin üstverisi. Baytlar Storage''da (email-attachments, özel); satır tek başına indirme vermez.';

create index if not exists idx_email_attachments_email
  on public.email_attachments (email_id);

-- ---- özel Storage bucket'ı (ekler) ------------------------------------------
-- Herkese açık product-media'ya ek yazılmaz. Bu bucket özeldir: okuma dahil
-- her işlem admin rolüne bağlıdır; indirme yalnızca imzalı URL ile.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-attachments',
  'email-attachments',
  false,
  15728640, -- 15 MB
  null       -- tür kısıtı yok; uygulama boyut üst sınırı + yalnızca-indirme uygular
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists email_attachments_admin_select on storage.objects;
drop policy if exists email_attachments_admin_insert on storage.objects;
drop policy if exists email_attachments_admin_update on storage.objects;
drop policy if exists email_attachments_admin_delete on storage.objects;

-- Herkese açık okuma politikası bilerek YOK: bu bucket özeldir.

create policy email_attachments_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'email-attachments' and (select public.has_admin_role()));

create policy email_attachments_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'email-attachments' and (select public.has_admin_role()));

create policy email_attachments_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'email-attachments' and (select public.has_admin_role()))
  with check (bucket_id = 'email-attachments' and (select public.has_admin_role()));

create policy email_attachments_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'email-attachments' and (select public.has_admin_role()));

-- ---- RLS (tablolar) ----------------------------------------------------------
-- contact_messages deseni: InitPlan için skaler alt sorguda has_admin_role,
-- anon'a grant yok, yazma da admin'e bağlı (webhook service role ile yazar).

alter table public.email_threads enable row level security;
alter table public.emails enable row level security;
alter table public.email_attachments enable row level security;

revoke all on table public.email_threads from anon;
revoke all on table public.emails from anon;
revoke all on table public.email_attachments from anon;

drop policy if exists email_threads_admin_select on public.email_threads;
drop policy if exists email_threads_admin_insert on public.email_threads;
drop policy if exists email_threads_admin_update on public.email_threads;

create policy email_threads_admin_select on public.email_threads
  for select to authenticated
  using ((select public.has_admin_role()));

create policy email_threads_admin_insert on public.email_threads
  for insert to authenticated
  with check ((select public.has_admin_role()));

create policy email_threads_admin_update on public.email_threads
  for update to authenticated
  using ((select public.has_admin_role()))
  with check ((select public.has_admin_role()));

drop policy if exists emails_admin_select on public.emails;
drop policy if exists emails_admin_insert on public.emails;
drop policy if exists emails_admin_update on public.emails;

create policy emails_admin_select on public.emails
  for select to authenticated
  using ((select public.has_admin_role()));

create policy emails_admin_insert on public.emails
  for insert to authenticated
  with check ((select public.has_admin_role()));

create policy emails_admin_update on public.emails
  for update to authenticated
  using ((select public.has_admin_role()))
  with check ((select public.has_admin_role()));

drop policy if exists email_attachments_admin_select on public.email_attachments;
drop policy if exists email_attachments_admin_insert on public.email_attachments;
drop policy if exists email_attachments_admin_update on public.email_attachments;

create policy email_attachments_admin_select on public.email_attachments
  for select to authenticated
  using ((select public.has_admin_role()));

create policy email_attachments_admin_insert on public.email_attachments
  for insert to authenticated
  with check ((select public.has_admin_role()));

create policy email_attachments_admin_update on public.email_attachments
  for update to authenticated
  using ((select public.has_admin_role()))
  with check ((select public.has_admin_role()));

grant select, insert, update on public.email_threads to authenticated;
grant select, insert, update on public.emails to authenticated;
grant select, insert, update on public.email_attachments to authenticated;
