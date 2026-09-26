-- ============================================================================
-- S23 (preview recognizer + slug shape): DB slug guarantees.
--
-- WHAT: CHECK constraints mirroring slugSchema (2..80 chars,
-- ^[a-z0-9]+(-[a-z0-9]+)*$) on products, producers, categories, blog_posts,
-- blog_categories and blog_tags slugs; products + producers additionally
-- reject the reserved onizleme- preview prefix.
--
-- Verified live 2026-09-26 before adding: zero shape violations on all six
-- tables (products 12, producers 10, categories 13, blog tables empty) and
-- zero onizleme- slugs on products/producers — safe to add.
--
-- ROLLBACK: drop the six ..._slug_shape_check constraints (and the two
-- ..._slug_no_preview_prefix constraints).
--
-- BACKWARD COMPATIBILITY: every existing row passes (verified); admin writes
-- already validate through slugSchema, so legitimate saves are unaffected.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_slug_shape_check') then
    alter table public.products
      add constraint products_slug_shape_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_slug_no_preview_prefix') then
    alter table public.products
      add constraint products_slug_no_preview_prefix
      check (slug not like 'onizleme-%');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'producers_slug_shape_check') then
    alter table public.producers
      add constraint producers_slug_shape_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'producers_slug_no_preview_prefix') then
    alter table public.producers
      add constraint producers_slug_no_preview_prefix
      check (slug not like 'onizleme-%');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'categories_slug_shape_check') then
    alter table public.categories
      add constraint categories_slug_shape_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_posts_slug_shape_check') then
    alter table public.blog_posts
      add constraint blog_posts_slug_shape_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_categories_slug_shape_check') then
    alter table public.blog_categories
      add constraint blog_categories_slug_shape_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blog_tags_slug_shape_check') then
    alter table public.blog_tags
      add constraint blog_tags_slug_shape_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80);
  end if;
end;
$$;
