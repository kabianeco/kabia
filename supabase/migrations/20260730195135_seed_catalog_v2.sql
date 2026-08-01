-- BASELINE (reconstructed) — see 20260730194034_create_schema.sql for context.
--
-- The original migration under this version seeded the live catalogue:
-- 5 categories, 12 products, 25 variants, 48 images and 12 nutrition rows.
--
-- That seed *data* is intentionally NOT reproduced here. It is live production
-- content that is now edited through the admin dashboard, so copying a snapshot
-- of it into a migration would go stale the moment a product is edited and
-- would risk overwriting real edits if the file were ever replayed.
--
-- Consequence, recorded honestly: replaying this migration set against a fresh
-- Supabase project produces the correct *schema* with an empty catalogue. Use
-- the admin dashboard (or a dump of the live data) to populate it.
--
-- This file exists so the version recorded in the remote migration history has
-- a matching file in the repository.

select 1;
