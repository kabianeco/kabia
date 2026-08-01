-- BASELINE (reconstructed) — see 20260730194034_create_schema.sql for context.
--
-- The original migration under this version seeded 36 product reviews, which in
-- turn drove the rating aggregate triggers. As with the catalogue seed, that
-- data is live content and is deliberately not snapshotted into a migration.
--
-- This file exists so the version recorded in the remote migration history has
-- a matching file in the repository.

select 1;
