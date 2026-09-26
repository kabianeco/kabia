-- ============================================================================
-- 2026-09-27 çalışması: canlı geçmiş satırları ↔ repo dosyaları eşleşmesi.
--
-- WHAT: bu dosya DOCUMENTATION ONLY'dur (işlevsel değişiklik yok). Supabase
-- MCP apply_migration aracı her DDL çağrısını ayrı bir geçmiş satırı olarak
-- kaydettiği için, aşağıdaki 4 repo dosyası canlıda birden fazla satıra
-- karşılık gelir. İçerik birebir aynıdır; bölünme yalnızca uygulama
-- biçiminden kaynaklanır.
--
--   supabase/migrations/20260927000100_order_override_flag.sql  (Bug 2)
--     → order_override_flag, order_override_rpc_flag, order_override_grants
--   supabase/migrations/20260927000200_customer_numbers.sql     (Feature 1)
--     → customer_numbers_part1_column_generator,
--       customer_numbers_part2_handle_new_user,
--       customer_numbers_part3_backfill_constraints,
--       customer_numbers_part4_constraints, customer_numbers_part5_guard,
--       customer_numbers_part6_view_recreate,
--       customer_numbers_part7_tr_messages,
--       customer_numbers_part8_turkish_messages,
--       customer_numbers_part9_final_messages,
--       customer_numbers_final_tr, customer_numbers_final_messages_tr,
--       customer_numbers_messages_final
--   supabase/migrations/20260927000300_admin_create_order.sql   (Feature 2)
--     → admin_create_order_part1_columns, admin_create_order_part2_checks,
--       admin_create_order_rpc, admin_create_order_grants,
--       admin_create_order_messages_tr
--   supabase/migrations/20260927000400_customer_password_flag.sql (Feature 3)
--     → customer_password_flag_part1, customer_password_flag_part2_guard,
--       customer_password_flag_part3_rpcs,
--       customer_password_flag_part4_admin_rpc,
--       customer_password_flag_messages_tr, customer_password_flag_guard_fix
--
-- Ayrıca canlıda dosyası olmayan iki eski satır (bu çalışmadan önce de vardı,
-- 20260926000100_record_live_drift_orphaned_migrations.sql kaydında yok):
--   * create_order_integrity_reapply_with_overload_drop
--   * rate_limit_fixed_windows
--   Bunların SQL'i kurtarılamadı; içerik canlı doğrulamayla (pg_get_functiondef
--   ve ilgili nesneler) tutarlı. Sahibi isterse bu satırlar için de dosya
--   yazılabilir; işlevsel bir eksik yoktur.
--
-- ROLLBACK: not applicable (no-op).
-- ============================================================================

-- Intentional no-op so the migration has a replayable, zero-effect body.
do $$
begin
  raise notice 'history map only: part rows correspond to the four repo files above; nothing to do.';
end;
$$;
