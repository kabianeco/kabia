-- ============================================================================
-- Phase 2 — reviews: drop the blanket public read; public_reviews becomes a
-- security-invoker view that cannot expose user_id.
--
-- WHAT:
--   1. drop policy reviews_public_read (SELECT using true for PUBLIC). The
--      storefront reads public.public_reviews only (lib/catalog.ts); the only
--      other non-admin base-table use is the review INSERT (return=minimal).
--   2. reviews.account_backed: stored generated column (user_id is not null),
--      so the public projection no longer needs to read user_id at all.
--   3. Column-level read: table-level SELECT on reviews is revoked from anon
--      and authenticated and re-granted on the safe columns only (everything
--      except user_id). A request for user_id — or select=* — through the
--      Data API now fails with 42501 for those roles.
--   4. reviews_public_projection_read: SELECT using (true) for anon and
--      authenticated — row visibility for the safe columns above. Together
--      with (3) this is the invoker-side equivalent of the old definer view.
--   5. public.public_reviews re-created WITH (security_invoker = true),
--      selecting the stored account_backed column. SELECT only for anon and
--      authenticated (write privileges on the view revoked).
--
-- WHY: reviews_public_read let anyone read reviews.user_id from the base
--   table, and the definer view was advisor 0010 (security_definer_view).
--
-- UNCHANGED: INSERT/UPDATE/DELETE grants and the *_own policies, the admin
--   SELECT policy, both triggers. Note: the authenticated role (admins
--   included) can no longer read reviews.user_id through the Data API; no
--   admin page reads reviews today. Server code needing it uses service_role.
--
-- IDEMPOTENT: if-exists/if-not-exists guards; grants/revokes repeatable.
--
-- ROLLBACK:
--   drop policy if exists reviews_public_projection_read on public.reviews;
--   grant select on table public.reviews to anon, authenticated;
--   create policy reviews_public_read on public.reviews for select using (true);
--   create or replace view public.public_reviews as select id, product_id,
--     reviewer_name, rating, review_text, is_verified_purchase, created_at,
--     (user_id is not null) as account_backed from public.reviews r;
--   alter view public.public_reviews reset (security_invoker);
--   grant all on public.public_reviews to anon, authenticated;
--   alter table public.reviews drop column if exists account_backed;
--   Pre-change snapshot: /Users/mustafa/kabia-maturity-pass/db-snapshots/20260926T-phase2-02-reviews-pre.json
-- ============================================================================

drop policy if exists reviews_public_read on public.reviews;

alter table public.reviews
  add column if not exists account_backed boolean generated always as (user_id is not null) stored;

revoke select on table public.reviews from anon, authenticated;
grant select (id, product_id, reviewer_name, rating, review_text, is_verified_purchase, created_at, account_backed)
  on public.reviews to anon, authenticated;

drop policy if exists reviews_public_projection_read on public.reviews;
create policy reviews_public_projection_read on public.reviews
  for select to anon, authenticated using (true);

create or replace view public.public_reviews with (security_invoker = true) as
  select id, product_id, reviewer_name, rating, review_text, is_verified_purchase, created_at, account_backed
  from public.reviews;

revoke all on public.public_reviews from anon, authenticated;
grant select on public.public_reviews to anon, authenticated;

notify pgrst, 'reload schema';
