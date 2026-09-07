-- ---------------------------------------------------------------------------
-- KABIA Phase 2 — producers become administrable: source, desc, sort_order.
--
-- WHY THESE COLUMNS
--
-- `public.producers` holds ten published rows but has nowhere to record which
-- of the three lines a producer belongs to, what one-line copy its card shows,
-- or where it stands in a curated order:
--
--   * `source` — ciftlik / secki / mutfak. `/secki` cannot be rebuilt from the
--     database without it: the route currently reads the keys of the
--     `producerCollections` object in `content/producers.ts`, and the table has
--     no equivalent. Reuses the existing `public.product_source` enum rather
--     than adding a second vocabulary for the same three lines.
--   * `desc` — the one-line card copy `/secki` prints under the producer name.
--     This value lives only in `content/producers.ts`; no migration has ever
--     given it a column (see docs/audit-2026-09-07.md §2, `/secki` table).
--   * `sort_order` — display order for `/ureticiler` (currently fixed
--     `created_at desc`, uncuratable) and later `/secki`.
--
-- `public.categories.sort_order` lets the storefront filter bar be curated
-- instead of relying on collation order. The bar currently sorts administered
-- names under Turkish collation in code.
--
-- BACKFILL, NOT HAND ENTRY
--
-- All three values already exist in reviewed form: `source` and `desc` are the
-- `producerCollections` entries in `content/producers.ts` (whose ten slugs
-- match the ten live rows exactly), and every producer's linked products agree
-- on a single `source` that matches that mapping 10/10 — verified by query,
-- not assumed. Hand-entering ten Turkish strings with quotes through a form
-- invites transcription drift; the migration below writes the reviewed values
-- once, idempotently (re-running sets the same values).
--
-- `sort_order` reproduces today's display order, so landing this migration
-- changes nothing visible: producers keep `created_at desc` (0, 10, 20, …
-- from newest to oldest, leaving gaps for later inserts), categories keep the
-- order the filter bar shows today (by slug, which for the current thirteen
-- rows matches the Turkish-collation name order exactly). Curation happens
-- afterwards through the admin screen. New rows default to 0 and an admin
-- moves them where they belong.
--
-- SAFETY ON TEN LIVE ROWS
--
--   * `source` follows the taxonomy migration's own pattern: added nullable,
--     backfilled below, then SET NOT NULL. No row can be left without one.
--   * `desc` is nullable, like every other producer detail column — missing
--     copy renders as missing, never as a broken row.
--   * `sort_order` is NOT NULL with `default 0` and `check (>= 0)`, mirroring
--     the `base_price >= 0` / `display_order` conventions: existing rows take
--     the default, then the backfill assigns explicit values.
--   * RLS: unchanged. The three producers policies are table-level
--     (`is_published` public read, `has_admin_role()` admin read/write) and
--     already cover new columns. Categories policies likewise.
--   * No DROP, no TRUNCATE, no DELETE. The old
--     `idx_producers_published (created_at desc)` index is kept; the new
--     ordering index sits alongside it.
--
-- Rollback: alter table public.producers drop column source / desc /
--           sort_order; alter table public.categories drop column sort_order;
--           drop index if exists idx_producers_published_order.
-- ---------------------------------------------------------------------------

-- ---- producers: new columns -------------------------------------------------

alter table public.producers
  add column if not exists source public.product_source;

alter table public.producers
  add column if not exists desc text;

alter table public.producers
  add column if not exists sort_order integer not null default 0 check (sort_order >= 0);

comment on column public.producers.source is
  'Which of Kabia''s three product lines this producer belongs to: ciftlik (own farm), secki (trusted producers), mutfak (traditional small-batch). Drives /secki membership.';
comment on column public.producers.desc is
  'One-line card copy shown under the producer name on /secki and /ureticiler.';
comment on column public.producers.sort_order is
  'Curated display order, ascending. Gaps of ten leave room for inserts; new rows default to 0 (front) until placed.';

create index if not exists idx_producers_published_order
  on public.producers (sort_order asc, created_at desc) where is_published;

-- ---- categories: sort_order ---------------------------------------------------

alter table public.categories
  add column if not exists sort_order integer not null default 0 check (sort_order >= 0);

comment on column public.categories.sort_order is
  'Curated order for the storefront filter bar, ascending. Replaces Turkish-collation name order once the bar reads it.';

-- ---- backfill: producers ------------------------------------------------------
-- Values from content/producers.ts; cross-checked 10/10 against each
-- producer's linked products' distinct source before writing this file.

update public.producers set source = 'ciftlik', desc = $$Organik sertifikalı, ekolojik hasadımız.$$, sort_order = 90 where slug = 'kabia-ciftligi';
update public.producers set source = 'secki', desc = $$Sade, doğal ve olduğu gibi.$$, sort_order = 80 where slug = 'geyce-setce-findik';
update public.producers set source = 'secki', desc = $$Doğal üretim.$$, sort_order = 70 where slug = 'ege-ceviz';
update public.producers set source = 'secki', desc = $$Gezgin değil, sabit kovan. Aynı flora, aynı rakım.$$, sort_order = 60 where slug = 'anadolu-bal';
update public.producers set source = 'secki', desc = $$Doğal ürün.$$, sort_order = 50 where slug = 'akinci-ihlamur';
update public.producers set source = 'mutfak', desc = $$Mevsiminde olgunlaşan domatesler, güneşte ağır ağır kurutulur.$$, sort_order = 40 where slug = 'domates-salcasi';
update public.producers set source = 'mutfak', desc = $$Geyve'nin elmalarından, annelerimizin yaptığı gibi.$$, sort_order = 30 where slug = 'elma-sirkesi';
update public.producers set source = 'mutfak', desc = $$Geyve alıçlarından, doğal fermentasyonla.$$, sort_order = 20 where slug = 'alic-sirkesi';
update public.producers set source = 'mutfak', desc = $$Un, yumurta ve tuz. Ovalarda kurutulan yufka, elle kesilir.$$, sort_order = 10 where slug = 'eriste';
update public.producers set source = 'mutfak', desc = $$Domates, biber, yoğurt ve un. Geleneksel tarhana fermantasyonu.$$, sort_order = 0 where slug = 'tarhana';

alter table public.producers alter column source set not null;

-- ---- backfill: categories -------------------------------------------------------
-- Ascending by slug reproduces the filter bar's current Turkish-collation
-- order for the thirteen existing rows (verified pair by pair: the slugs are
-- ASCII folds of the names, so both orders agree). New categories land at 0
-- until curated.

update public.categories set sort_order = case slug
  when 'bal' then 0
  when 'ceviz' then 10
  when 'cig-badem' then 20
  when 'eriste' then 30
  when 'findik' then 40
  when 'ihlamur' then 50
  when 'kabia-ciftligi' then 60
  when 'kabia-mutfak' then 70
  when 'kabia-secki' then 80
  when 'kabuklu-badem' then 90
  when 'salca' then 100
  when 'sirke' then 110
  when 'tarhana' then 120
  else 1000
end;
