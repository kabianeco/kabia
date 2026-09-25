-- ============================================================================
-- Recorded from live on 2026-09-26; already applied; do not re-apply.
-- Reconstructs the drift described in BRIEF §2.3 / §7: two migrations were
-- applied to production with no file, and
-- 20260803020000_order_state_machine_and_rpc_hardening.sql was superseded.
--
-- WHAT: this migration is DOCUMENTATION ONLY. It changes nothing functional:
-- every statement below is a comment. It exists so the repository finally
-- describes the live database. All bodies were verified live on 2026-09-26
-- via pg_get_functiondef / pg_policies / information_schema on project
-- xlubpolwuseafpcienql. Full texts are snapshotted under
-- /Users/mustafa/kabia-maturity-pass/db-snapshots/20260925T2344-*.sql.
--
-- ROLLBACK: not applicable (no-op). Replaying this file is safe.
--
-- BACKWARD COMPATIBILITY: no schema or function change, so deployed code is
-- unaffected by definition.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Orphaned migration 1 (no file): `admin_override_and_setting_hardening`
-- Applied from another checkout, never committed here. Created, live:
--   * public.setting_bool / public.setting_number now filter
--       is_public = true AND is_sensitive = false
--     (repo file 20260801000700_site_settings.sql lacks the is_sensitive half)
--   * public.setting_bool_privileged / public.setting_number_privileged
--     (SECURITY DEFINER, no is_public/is_sensitive filter, EXECUTE granted to
--     postgres + service_role ONLY)
--   * public.enforce_order_status_transition() restored to the STRICT matrix:
--       hazirlaniyor -> {kargoda, teslim_edildi, iptal_edildi}
--       kargoda      -> {teslim_edildi, iptal_edildi}
--     (repo file 20260801003000_relax_order_status_transition.sql says
--     any-to-any; live contradicts it)
--   * public.admin_update_order_status() with the same strict matrix inside
--     the RPC (idempotent same-status success, Turkish check_violation error)
--   * public.admin_override_order_status(p_order_id uuid, p_status
--     order_status, p_reason text): super-admin only (is_super_admin()),
--     reason required (1..500 chars), writes order_notes
--     'GEÇERSİZ DURUM GEÇİŞİ: <reason>' + log_admin_action
--     ('order.status_override'), bypasses the trigger via
--     ALTER TABLE ... DISABLE/ENABLE TRIGGER enforce_order_status_transition
--     (runs as owner through SECURITY DEFINER, so the ALTER succeeds)
--   * public.create_order() gate moved to
--     setting_bool_privileged('checkout_enabled', true)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Orphaned migration 2 (no file): `auth_rate_limiting_functions`
-- Created, live:
--   * private.consume_auth_rate_limit(p_bucket_kind, p_dimension,
--     p_window_kind, p_key_hash, p_window_secs, p_max_count) -> jsonb
--     (SECURITY DEFINER, search_path private/pg_temp, upserts
--     private.auth_rate_limit_buckets, returns
--     {allowed, count, max_count, retry_after}; EXECUTE granted to postgres +
--     service_role ONLY)
--   * NO public wrapper exists live (verified 2026-09-26: exactly one
--     pg_proc row, (private, consume_auth_rate_limit)). Callers without
--     .schema("private") get PGRST202 and fail open — fixed by S7.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Superseded file: 20260803020000_order_state_machine_and_rpc_hardening.sql
-- Committed but never applied as written; its live-equivalent content arrived
-- via orphaned migration 1 above. The repo file remains as the design record;
-- live truth is documented here. Do NOT apply the repo file: its trigger text
-- is already live in equivalent form, and re-applying would be a no-op at
-- best. (Its admin_override_order_status DISABLE TRIGGER pattern is live and
-- intentionally kept — see S13 notes.)
-- ----------------------------------------------------------------------------

-- Intentional no-op so the migration has a replayable, zero-effect body.
do $$
begin
  raise notice 'drift record only: live definitions already applied; nothing to do.';
end;
$$;
