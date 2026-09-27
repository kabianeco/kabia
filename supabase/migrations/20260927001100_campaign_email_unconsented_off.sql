-- ============================================================================
-- Campaign e-mail opt-in repair: turn off unconsented legacy defaults.
--
-- WHAT:
--   * Sets notification_preferences.campaign_emails = false for every row
--     that is currently on (true) but has NO customer_consents row of kind
--     'marketing_email' — i.e. accounts whose "on" came from the old
--     DEFAULT TRUE, not from a recorded choice at registration or in
--     account settings.
--   * Rows with a recorded consent (granted true or false) are untouched;
--     rows already off are untouched. Live 2026-09-27 this matches exactly
--     one account (c2cc83f4-fb41-4bc2-94de-93f6f4f9194a); pre-state snapshot:
--     /Users/mustafa/kabia-maturity-pass/db-snapshots/20260927T1521-item6-notification-prefs-pre.json
--
-- WHY: campaign e-mail is opt-in everywhere since
--   20260926002500_customer_consents.sql (DEFAULT false, handle_new_user
--   seeds from the registration choice, set_marketing_email_consent logs).
--   The two pre-existing rows predate that migration and kept the old
--   default true without any consent record — sending to them would be
--   unconsented marketing mail.
--
-- IDEMPOTENT: the WHERE clause matches only rows still needing the fix;
--   re-running affects zero rows.
--
-- ROLLBACK (only if the owner confirms the address had real consent):
--   update public.notification_preferences set campaign_emails = true
--   where user_id = 'c2cc83f4-fb41-4bc2-94de-93f6f4f9194a';
-- ============================================================================

update public.notification_preferences np
set campaign_emails = false
where np.campaign_emails is distinct from false
  and not exists (
    select 1 from public.customer_consents cc
    where cc.user_id = np.user_id
      and cc.kind = 'marketing_email'
  );

notify pgrst, 'reload schema';
