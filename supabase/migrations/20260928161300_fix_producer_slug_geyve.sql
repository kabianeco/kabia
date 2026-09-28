-- Producer slug typo: geyce-setce-findik -> geyve-setce-findik (Geyve).
--
-- WHAT: rename the Seçki hazelnut producer's story slug to the correct
--   "geyve" spelling. Only public.producers.slug changes; the row id is
--   untouched, and products reference the producer by producer_id UUID, so
--   no other row needs to move. Old URLs keep working via permanent
--   redirects in next.config.ts (added in the same commit).
-- WHY: "geyce" is a typo of Geyve, a target keyword; the name already reads
--   "Geyve — Setçe Köyü Aile Bahçesi".
-- IDEMPOTENT: guarded on the old slug; safe to re-run (second run is a no-op).
-- ROLLBACK: restore slug from
--   /Users/mustafa/kabia-maturity-pass/db-snapshots/20260928T1613-producer-slug-pre.json:
--     update public.producers set slug = 'geyce-setce-findik'
--     where id = '7bda56b5-ea22-4799-845c-35f3b4a67860';

update public.producers
set slug = 'geyve-setce-findik'
where slug = 'geyce-setce-findik'
  and id = '7bda56b5-ea22-4799-845c-35f3b4a67860'
  and not exists (select 1 from public.producers p where p.slug = 'geyve-setce-findik');
