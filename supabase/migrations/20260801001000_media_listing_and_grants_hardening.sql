-- ---------------------------------------------------------------------------
-- Follow-up to the Supabase security advisor run after 20260801000900.
--
-- 1. `public_bucket_allows_listing` — the broad SELECT policy on
--    storage.objects let anyone enumerate every file in the product-media
--    bucket. A *public* bucket serves object URLs through
--    /storage/v1/object/public/... without any SELECT policy at all, so the
--    policy was buying nothing for the storefront and leaking a file listing.
--    SELECT is narrowed to administrators, who genuinely need it: the media
--    manager lists objects, and Storage upsert requires INSERT + SELECT +
--    UPDATE together or replacing an image silently fails.
--
--    Public product images continue to load — that path does not consult this
--    policy.
--
-- 2. `anon_security_definer_function_executable` on public.rls_auto_enable() —
--    a pre-existing platform event-trigger function that Postgres had granted
--    to PUBLIC by default. Event triggers are fired by the DDL system, never by
--    a role's EXECUTE privilege, so revoking it removes an RPC endpoint without
--    affecting the trigger.
--
-- Deliberately NOT changed here, and reported instead:
--   * `authenticated_security_definer_function_executable` on the admin RPCs.
--     That is the intended design: each function re-checks the caller's role in
--     its own body and returns aggregates only. Making them SECURITY INVOKER
--     would break the audit-log write path and the role lookups that RLS itself
--     depends on.
--   * `auth_leaked_password_protection` is disabled on this project. That is
--     pre-existing Auth configuration, not something this work introduced, and
--     it is not weakened here. See docs/admin-operations.md.
--
-- Rollback: recreate product_media_public_read as `to anon, authenticated`.
-- ---------------------------------------------------------------------------

drop policy if exists product_media_public_read on storage.objects;

create policy product_media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'product-media' and public.has_admin_role());

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
