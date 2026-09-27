-- ============================================================================
-- DO NOT RE-APPLY — documentation only. Already applied live as
-- version 20260925235844 (name rate_limit_fixed_windows).
--
-- WHAT (live statement, recorded 2026-09-27 from
-- supabase_migrations.schema_migrations): CREATE OR REPLACE FUNCTION
-- private.consume_auth_rate_limit(p_bucket_kind text, p_dimension text,
-- p_window_kind text, p_key_hash text, p_window_secs integer,
-- p_max_count integer) RETURNS jsonb, LANGUAGE plpgsql, SECURITY DEFINER,
-- SET search_path TO 'private', 'pg_temp'. Fixed-window bucketing:
--   v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_secs) * p_window_secs);
--   v_window_end := v_window_start + (p_window_secs || ' seconds')::interval;
--   stale windows deleted; upsert on
--   (bucket_kind, dimension, window_kind, key_hash, window_start) with
--   count+1; returns {allowed, count, max_count, retry_after}.
--   Key-hash length (8..64) and window (>= 1s) validated, 22023 on abuse.
--
-- WHY IT EXISTS: replaced the earlier rate-limit bucket logic with fixed
--   windows so limits reset on predictable boundaries instead of sliding
--   per-key. Callers go through the public wrapper from
--   supabase/migrations/20260926000500_rate_limit_public_wrapper.sql.
--   Live 2026-09-27 exactly one pg_proc row matches
--   (private, consume_auth_rate_limit) with the 6-arg signature above.
--
-- ROLLBACK: not applicable (no-op). Replaying this file is safe.
--
-- BACKWARD COMPATIBILITY: no schema or function change by definition.
-- ============================================================================

-- Intentional no-op so the migration has a replayable, zero-effect body.
do $$
begin
  raise notice 'drift record only: rate_limit_fixed_windows already applied live as 20260925235844; nothing to do.';
end;
$$;
