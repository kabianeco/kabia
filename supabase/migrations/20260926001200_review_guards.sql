-- ============================================================================
-- S18 (reviews written from the browser, unbounded): length guarantees at
-- rest. The write path itself moves to lib/reviews/actions.ts (zod +
-- review_submit rate limit + one-per-user); these CHECKs mirror that schema
-- the way contact_messages mirrors its own.
--
-- Bounds: review_text 10..2000 chars; reviewer_name null (trigger fills from
-- the profile) or 1..120 chars. Verified live 2026-09-26: all 6 rows pass
-- (texts 56-78 chars, names 10-12 chars) — safe to add.
--
-- ROLLBACK: alter table public.reviews drop constraint reviews_text_length;
-- alter table public.reviews drop constraint reviews_name_length;
--
-- BACKWARD COMPATIBILITY: no existing row violates either bound (verified);
-- the deployed browser insert sends name + text within these bounds (its UI
-- requires both non-empty), so deployed writes keep succeeding.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_text_length') then
    alter table public.reviews
      add constraint reviews_text_length
      check (char_length(btrim(review_text)) between 10 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_name_length') then
    alter table public.reviews
      add constraint reviews_name_length
      check (reviewer_name is null or char_length(btrim(reviewer_name)) between 1 and 120);
  end if;
end;
$$;
