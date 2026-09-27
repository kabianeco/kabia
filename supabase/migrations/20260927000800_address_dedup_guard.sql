-- ============================================================================
-- Address identical-save guard (Problem 2).
--
-- WHAT:
--   * Unique index uq_addresses_user_identical on
--     (user_id, label, full_name, phone, address_line1,
--      coalesce(address_line2, ''), city, district, postal_code).
--     Exact-match backstop for the app-level normalized reuse in
--     lib/checkout-context.tsx + lib/addresses/normalize.ts: a double submit
--     racing past the client guard still collapses to one row (second INSERT
--     fails 23505, the form keeps its message path).
--
-- WHY: the customer saved one "ev" address once; checkout/admin order
--   creation snapshots (create_order / admin_create_order take jsonb, no
--   addresses write) never insert. Duplicates came from explicit saves without
--   an identical check (addAddress), guest-merge without dedup, and double
--   submits slipping the async `saving` flag. Live read 2026-09-27 showed 2
--   rows across 2 users, no identical group within a user, so the index
--   builds cleanly (snapshot:
--   /Users/mustafa/kabia-maturity-pass/db-snapshots/20260927T-address-dedup-pre.json).
--
-- IDEMPOTENT: CREATE UNIQUE INDEX IF NOT EXISTS is repeatable.
--
-- ROLLBACK: drop index if exists public.uq_addresses_user_identical;
-- ============================================================================

create unique index if not exists uq_addresses_user_identical
  on public.addresses (
    user_id,
    label,
    full_name,
    phone,
    address_line1,
    (coalesce(address_line2, '')),
    city,
    district,
    postal_code
  );
