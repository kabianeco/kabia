-- ============================================================================
-- §8.1 (producer data convergence): database becomes the single source of
-- truth, seeded from the storefront's curated copy where they differ.
--
-- WHAT (all idempotent scoped UPDATEs; snapshot in
-- db-snapshots/20260926-producers-pre-convergence.txt):
--   * Content (content/producers.ts is the more recent editorial copy):
--       geyce-setce-findik: name -> 'Geyve — Setçe Köyü Aile Bahçesi'
--                           photo_url -> '/images/findik2.jpeg'
--       domates-salcasi:    tagline -> kazanda version (the DB backfill said
--                           güneşte, contradicting the file and its own story)
--     Everything else (names, taglines, photos, regions, stories) already
--     matches the file — verified slug by slug on 2026-09-26.
--   * sort_order so the HOMEPAGE STRIP's current order is preserved
--     (most-viewed surface; secki file order findik->ceviz->bal->ihlamur),
--     mutfak in file order, ciftligi first (as on /ureticiler today):
--       kabia-ciftligi 0, geyce-setce-findik 10, ege-ceviz 20,
--       anadolu-bal 30, akinci-ihlamur 40, domates-salcasi 50,
--       elma-sirkesi 60, alic-sirkesi 70, eriste 80, tarhana 90
--
-- EXPECTED VISIBLE MOVES (vs today; /secki, home strip, /mutfak switch to
-- these rows in code commits after this migration):
--   /ureticiler: ceviz<->findik swap; elma<->alic swap; findik name+photo.
--   /secki + homepage strip: findik name+photo (order unchanged).
--   /mutfak: no moves (file order == new order).
--   /ureticiler/[slug] findik page: name+photo (+ paragraph spacing on all
--   producer pages from the story-paragraph render change).
--
-- ROLLBACK: re-apply the snapshot values (UN DO by slug).
--
-- BACKWARD COMPATIBILITY: UPDATEs only, no schema change; deployed pages read
-- the same rows (ureticiler/magaza shelf already read the DB). The findik
-- name/photo and domates tagline changes are the specified editorial fix.
-- ============================================================================

update public.producers set name = 'Geyve — Setçe Köyü Aile Bahçesi', photo_url = '/images/findik2.jpeg'
  where slug = 'geyce-setce-findik';

update public.producers set tagline = 'Mevsiminde olgunlaşan domatesler, kazanda ağır ağır koyulaşır.'
  where slug = 'domates-salcasi';

update public.producers set sort_order = 0  where slug = 'kabia-ciftligi';
update public.producers set sort_order = 10 where slug = 'geyce-setce-findik';
update public.producers set sort_order = 20 where slug = 'ege-ceviz';
update public.producers set sort_order = 30 where slug = 'anadolu-bal';
update public.producers set sort_order = 40 where slug = 'akinci-ihlamur';
update public.producers set sort_order = 50 where slug = 'domates-salcasi';
update public.producers set sort_order = 60 where slug = 'elma-sirkesi';
update public.producers set sort_order = 70 where slug = 'alic-sirkesi';
update public.producers set sort_order = 80 where slug = 'eriste';
update public.producers set sort_order = 90 where slug = 'tarhana';
