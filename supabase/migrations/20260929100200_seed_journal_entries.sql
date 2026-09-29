-- ---------------------------------------------------------------------------
-- Seed: the seven field-journal entries that lived in content/journal.ts.
--
-- WHAT
--   Inserts each entry exactly as it was in code (slug, date, location,
--   weather, orchardState, application, observation, outcome, photo, video),
--   published, plus one gallery row per entry that has a photo (that photo is
--   also the cover). The SQL body was generated from content/journal.ts, not
--   typed by hand, and verified against the live rows afterwards.
--
-- WHY
--   Phase 1 of the media move: the journal pages read the database once the
--   matching code is deployed. Until then the deployed code still reads
--   content/journal.ts, so applying this early changes nothing visible.
--
-- NOTE
--   Image paths are the current local /images/... paths on purpose; the
--   reference-switch migration later rewrites them to Storage URLs together
--   with the product and producer references.
--
-- IDEMPOTENT
--   Entries are inserted ON CONFLICT (lower(slug)) DO NOTHING; a gallery row is
--   only inserted for an entry that has none. Re-running changes nothing.
--
-- ROLLBACK
--   delete from public.journal_entries where slug in (
--     '2026-04-11-tomurcuk-cicek', '2026-04-07-mavi-legen', '2026-04-01-tomurcuk',
--     '2026-03-15-kaolin', '2026-02-25-kis-gunu', '2026-09-13-catlak-kabuk',
--     '2026-08-25-yesil-kabuk');   -- gallery rows cascade
-- ---------------------------------------------------------------------------

insert into public.journal_entries
  (slug, entry_date, location, weather, orchard_state, application, observation, outcome, cover_image_url, video_path, is_published)
values
  ('2026-04-11-tomurcuk-cicek', '2026-04-11', 'Kabia Çiftliği', 'Parçalı bulutlu 15°', 'Tomurcuklar patlıyor, ilk çiçekler açıyor', 'Yok — sadece gözlem', 'Dallar tomurcuktan çiçeğe dönüyor; bahçe beyaza bürünmeye başladı.', 'Arılar bekleniyor — çiçeklenme takipte.', '/images/gunluk-2026-04-11-mayis-tomurcuk.jpeg', null, true),
  ('2026-04-07-mavi-legen', '2026-04-07', 'Kabia Çiftliği', 'Açık 18°', 'Örtü bitkileri ve baklalar yeşeriyor', 'Mavi leğen tuzakları yerleştirildi', 'Tropinota hirta''ya karşı zehirsiz nöbet başladı: su dolu mavi leğenler sıralara kondu.', 'Erginler çiçeklerle beslenerek ürün kaybına yol açar, bu yüzden mavi leğen uygulaması yapıyoruz — bahçede zehir kullanılmıyor, doğa kendi dengesini kuruyor.', '/images/gunluk-2026-04-10-bakla.jpeg', null, true),
  ('2026-04-01-tomurcuk', '2026-04-01', 'Kabia Çiftliği', 'Açık 16°', 'Ağaçlar uyanıyor, dallar canlanıyor', 'Yok — sadece gözlem', 'Meyve gözleri yavaş yavaş kabarıyor; bahçe uyanmaya başladı.', 'Çiçeklenme bekleniyor — gözler dallarda.', '/images/gunluk-2026-04-01-tomurcuk.jpeg', null, true),
  ('2026-03-15-kaolin', '2026-03-15', 'Kabia Çiftliği', 'Parçalı bulutlu 13°', 'Tomurcuklar kabarıyor, ilk ilaçsız koruma zamanı', 'Doğal kil (kaolin) uygulaması', 'Dallara ince kil perdesi çekildi; zararlıya karşı zehirsiz kalkan.', 'Koruma tamam — gözlem sürüyor.', null, '/images/gunluk-2026-03-15-kaolin.mp4', true),
  ('2026-02-25-kis-gunu', '2026-02-25', 'Kabia Çiftliği', 'Güneşli 4°', 'Bahçe kar altında, ağaçlar uykuda', 'Yok — sadece kontrol', 'Kar üstünde sadece bizim ayak izlerimiz; dallar çıplak, kökler sıcak.', 'Kış uykusu sürüyor — bahar bekleniyor.', '/images/gunluk-2026-03-01-subat-kis.jpeg', null, true),
  ('2026-09-13-catlak-kabuk', '2026-09-13', 'Kabia Çiftliği', 'Açık 26°', 'Dış kabuk çatlamaya başladı', 'Yok — sadece gözlem', 'Dış kabuk çatlamaya başladı; ama hasat için biraz daha zaman var gibi.', 'Takip sürüyor — çatlama tamamlanınca hasat.', '/images/catlakkabuk.jpg', null, true),
  ('2026-08-25-yesil-kabuk', '2026-08-25', 'Kabia Çiftliği', 'Açık 28°', 'Dış kabuklar yeşil, çatlama henüz yok', 'Yok — sadece gözlem', 'Bademler dalda yeşil kabuğunda duruyor; çatlama başlamadı.', 'Hasat için erken — takip sürüyor.', '/images/yesilbadem.jpg', null, true)
on conflict ((lower(slug))) do nothing;

insert into public.journal_entry_images (entry_id, image_url, sort_order)
select e.id, v.image_url, 0
from (values
    ('2026-04-11-tomurcuk-cicek', '/images/gunluk-2026-04-11-mayis-tomurcuk.jpeg'),
    ('2026-04-07-mavi-legen', '/images/gunluk-2026-04-10-bakla.jpeg'),
    ('2026-04-01-tomurcuk', '/images/gunluk-2026-04-01-tomurcuk.jpeg'),
    ('2026-02-25-kis-gunu', '/images/gunluk-2026-03-01-subat-kis.jpeg'),
    ('2026-09-13-catlak-kabuk', '/images/catlakkabuk.jpg'),
    ('2026-08-25-yesil-kabuk', '/images/yesilbadem.jpg')
) as v(slug, image_url)
join public.journal_entries e on e.slug = v.slug
where not exists (select 1 from public.journal_entry_images i where i.entry_id = e.id);
