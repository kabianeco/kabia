-- ============================================================================
-- DO NOT RE-APPLY — documentation only. Already applied live as
-- version 20260925235457 (name create_order_integrity_reapply_with_overload_drop).
--
-- WHAT (live statement, recorded verbatim 2026-09-27 from
-- supabase_migrations.schema_migrations):
--   drop function if exists public.create_order(jsonb, text, text, text, text, text, text, text);
--
-- WHY IT EXISTS: the create_order integrity rework changed the signature
--   (consents became mandatory params 3-4, two new trailing params). The old
--   8-argument overload had to go or PostgREST/RPC routing could keep binding
--   stale clients to the pre-integrity body (no atomic stock decrement, no
--   consent checks). After the drop, exactly one overload remains live:
--   create_order(jsonb,text,boolean,boolean,text,text,text,text,text,text)
--   (verified 2026-09-27 via pg_proc).
--
-- REPO COVERAGE: the rework itself is
--   supabase/migrations/20260926000300_create_order_integrity.sql (which also
--   contains the same drop line); this file exists only so the live
--   migration-history entry has a repository counterpart.
--
-- ROLLBACK: not applicable (no-op). Replaying this file is safe.
--
-- BACKWARD COMPATIBILITY: no schema or function change by definition.
-- ============================================================================

-- Intentional no-op so the migration has a replayable, zero-effect body.
do $$
begin
  raise notice 'drift record only: create_order_integrity_reapply_with_overload_drop already applied live as 20260925235457; nothing to do.';
end;
$$;
