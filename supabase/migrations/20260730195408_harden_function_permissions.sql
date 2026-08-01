-- BASELINE (reconstructed) — see 20260730194034_create_schema.sql for context.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, which would make the
-- trigger functions in `public` callable by anon and authenticated. This
-- migration revoked that and granted execute only where it is actually needed.

revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.set_review_verification() from public, anon, authenticated;
revoke execute on function public.update_product_rating()   from public, anon, authenticated;
revoke execute on function public.touch_cart_updated_at()   from public, anon, authenticated;

revoke execute on function public.create_order(jsonb, text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.create_order(jsonb, text, text, text, text, text, text, text) to authenticated;
