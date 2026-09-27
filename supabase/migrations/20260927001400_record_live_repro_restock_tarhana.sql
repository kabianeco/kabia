-- ============================================================================
-- DO NOT RE-APPLY — documentation only. Already applied live as
-- version 20260927022247 (name repro_restock_tarhana_tmp).
--
-- WHAT (live statement, recorded 2026-09-27 from
-- supabase_migrations.schema_migrations):
--   DO $$ BEGIN PERFORM set_config('kabia.allow_stock_write','on',true);
--   UPDATE public.product_variants SET stock_quantity = stock_quantity + 10
--   WHERE id='01bb45fb-294f-4bdd-8dcb-88134cfc26f3'; END $$;
--
-- WHY IT IS RECORDED HERE: this was a DATA-ONLY stock correction (Tarhana /
--   "1kg" variant, +10 units) that went through apply_migration by mistake
--   instead of a direct, reviewed stock adjustment — so it left a
--   migration-history entry with no repository file. The correction itself
--   is legitimate operational data (no inventory_adjustments row was
--   written for it; subsequent order commits have since consumed the
--   quantity — stock reads 0 live on 2026-09-27).
--
-- LESSON: data fixes go through the admin stock-adjustment path (audited
--   inventory_adjustments rows), never through apply_migration. This file
--   exists only so the live migration-history entry has a repository
--   counterpart and the database is fully described by the repo.
--
-- ROLLBACK: not applicable (no-op). Do NOT "undo" the +10 — it was consumed
--   by real orders afterwards; a compensating change today would corrupt
--   stock. Replaying this file is safe.
--
-- BACKWARD COMPATIBILITY: no schema or function change by definition.
-- ============================================================================

-- Intentional no-op so the migration has a replayable, zero-effect body.
do $$
begin
  raise notice 'drift record only: repro_restock_tarhana_tmp already applied live as 20260927022247; nothing to do.';
end;
$$;
