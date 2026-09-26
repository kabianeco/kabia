-- ============================================================================
-- S20 / §5.1 (KVKK consent on contact + harvest-notify): record consent with
-- its server timestamp alongside the submission.
--
-- WHAT: two nullable columns on contact_messages (both forms write through
-- sendContactMessage into this table):
--   consent_kvkk boolean NULL — explicit consent checkbox state
--   consent_kvkk_at timestamptz NULL — server clock at submission
-- Optional (not required): deployed code inserts without them and keeps
-- working; the S19 contact guard is unaffected (INSERT path, and the columns
-- are never UPDATE targets).
--
-- ROLLBACK: alter table public.contact_messages drop column consent_kvkk_at;
-- alter table public.contact_messages drop column consent_kvkk;
--
-- BACKWARD COMPATIBILITY: purely additive nullable columns; deployed inserts
-- name their columns explicitly and are unaffected.
-- ============================================================================

alter table public.contact_messages
  add column if not exists consent_kvkk boolean;
alter table public.contact_messages
  add column if not exists consent_kvkk_at timestamptz;
