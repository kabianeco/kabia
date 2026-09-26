-- ============================================================================
-- S17 (reviewer name caller-supplied; user_id publicly readable):
--
-- WHAT:
--   1. set_review_verification(): reviewer_name is ALWAYS set from
--      profiles.full_name when user_id is present (previously only when the
--      caller sent null, letting anyone sign another name to their account
--      review). is_verified_purchase recomputation unchanged.
--   2. New public.public_reviews view: the safe public projection of reviews
--      — no user_id column, plus account_backed (user_id IS NOT NULL) so the
--      storefront keeps its seeded-row exclusion without the raw UUID.
--      Granted SELECT to anon + authenticated. This branch's storefront reads
--      the view (see lib/catalog.ts); nothing this branch renders needs
--      user_id anymore.
--   3. New reviews_admin_select (authenticated + has_admin_role()): no admin
--      read policy existed; added so a future admin UI never depends on the
--      public policy below.
--   4. reviews_public_read is KEPT (not dropped): the code currently deployed
--      in production selects reviews(..., user_id, ...) on product pages, so
--      removing it now would break those pages (§3.3). Follow-up AFTER this
--      branch deploys: drop policy reviews_public_read — at that point every
--      reader uses the view. Recorded in FINAL-REPORT.md (owner action).
--
-- ROLLBACK: restore the previous trigger body (fills name only when null);
-- drop view public.public_reviews; drop policy reviews_admin_select.
--
-- BACKWARD COMPATIBILITY: trigger still fills the same columns (only the
-- name source changes from caller-supplied to profile — the specified fix;
-- inserts keep succeeding). View + policy are purely additive. No signature,
-- grant or existing-policy change.
-- ============================================================================

create or replace function public.set_review_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  has_purchase boolean;
  v_name text;
begin
  if new.user_id is not null then
    select exists(
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.user_id = new.user_id
        and oi.product_id = new.product_id
    ) into has_purchase;
    new.is_verified_purchase := has_purchase;
    -- S17: the display name always comes from the account profile, never
    -- from the caller. Caller-supplied names were an impersonation vector.
    select p.full_name into v_name from public.profiles p where p.id = new.user_id;
    new.reviewer_name := v_name;
  else
    new.is_verified_purchase := coalesce(new.is_verified_purchase, false);
  end if;
  return new;
end;
$function$;

create or replace view public.public_reviews as
select
  r.id,
  r.product_id,
  r.reviewer_name,
  r.rating,
  r.review_text,
  r.is_verified_purchase,
  r.created_at,
  (r.user_id is not null) as account_backed
from public.reviews r;

grant select on public.public_reviews to anon, authenticated;

drop policy if exists reviews_admin_select on public.reviews;
create policy reviews_admin_select on public.reviews
  for select to authenticated using (public.has_admin_role());
