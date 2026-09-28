-- ============================================================================
-- Enrich the ten active product descriptions (SEO/perf pass 2, Phase 3 §6.1).
--
-- WHAT: products.description for the 10 active products. Each new text is the
--   owner's existing description, unchanged, as its first paragraph, followed
--   by paragraphs built only from stored facts: the producer's story
--   (producers.story), products.storage_conditions, products.shelf_life,
--   product_variants.label, and, for Seçki/Mutfak, the certification status as
--   products.certifications states it ("Sertifikasız — organik sertifikası
--   bulunmamaktadır."). Paragraphs are separated by a blank line, which the
--   product page renders as paragraphs. Every sentence is traced in
--   /Users/mustafa/kabia-seo-perf-2/CONTENT-SOURCES.md §5.
--   Not added: health or nutrition wording; certificate sentences for the
--   almond (the certificate is stated only through content/farm.ts, which
--   expires 3 Oct 2026); contested facts (almond drying C-8, Kayadibi C-10,
--   tarhana days/Taraklı C-12/C-13, ıhlamur bahçe/orman C-14).
-- WHY: all ten descriptions were thin (6–56 words) and none stated storage,
--   shelf life or certification status, though all three are stored.
-- IDEMPOTENT: each row updates only while its description still equals the
--   snapshot text, so a re-run, or an owner edit made in between, is left
--   alone. updated_at moves with the change (the sitemap's lastmod).
-- APPLIED: live via MCP apply_migration on 2026-09-28 (version 20260928120228);
--   verified 10/10 rows equal the new text (post snapshot
--   20260928T-phase3-product-descriptions-post.json).
-- SNAPSHOT: /Users/mustafa/kabia-maturity-pass/db-snapshots/
--   20260928T-phase3-product-descriptions-pre.json (id, slug, name,
--   description, updated_at of all 10 rows, read live before the write).
-- ROLLBACK: swap the columns — for each row below,
--   UPDATE public.products SET description = <old>, updated_at = now()
--   WHERE slug = <slug> AND description = <new>;
--   or restore from the snapshot file.
-- ============================================================================

UPDATE public.products AS p
SET description = v.new_description,
    updated_at = now()
FROM (VALUES
  ('alic-sirkesi',
   $kabia$Geyve Alıç meyvelerinden, doğal fermentasyonla. Filtre edilmez, tortulu, sirke anası ile 6 ay dinlendirilir. Katkısız, geleneksel.$kabia$,
   $kabia$Geyve Alıç meyvelerinden, doğal fermentasyonla. Filtre edilmez, tortulu, sirke anası ile 6 ay dinlendirilir. Katkısız, geleneksel.

Alıçlar sonbaharda tam olgunlaşınca tek tek toplanır, ezilir ve doğal fermentasyona bırakılır. Süzülmeden şişelenir; her şişe hangi alıç bahçesinden geldiği yazılarak kapanır.

Seçenekler: 500 ml ve 1 L. Saklama: Serin ve kuru yerde, ağzı kapalı saklayın. Raf ömrü: 24 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('ceviz-ici',
   $kabia$Kayadibi Köyü aile bahçesinden kabuklu ceviz. Doğal üretim, aile ölçeği, katkısız. Her paket hasat tarihli.$kabia$,
   $kabia$Kayadibi Köyü aile bahçesinden kabuklu ceviz. Doğal üretim, aile ölçeği, katkısız. Her paket hasat tarihli.

Ertuğrul'un bahçesinde 210 ceviz ağacı var. Budama elle, hasat elle; kurutma gölgede, tel ızgaralarda. Kabuk çatlamadan, içi tam kurumadan çuvala girmez.

Seçenekler: 500 g ve 1 kg. Saklama: Serin ve kuru yerde saklayın. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('cicek-bali',
   $kabia$Kılıçkaya Vadisi Sabırlar Kayadibi'nde sabit kovan, gezgin değil. Aynı flora, aynı rakım. Bal olgunlaşmadan alınmaz. Ham, süzme çiçek balı.$kabia$,
   $kabia$Kılıçkaya Vadisi Sabırlar Kayadibi'nde sabit kovan, gezgin değil. Aynı flora, aynı rakım. Bal olgunlaşmadan alınmaz. Ham, süzme çiçek balı.

Arıcı Yasin'in 78 kovanı aynı rakımda, aynı florada, aynı yerde duruyor. Şeker yok, erken hasat yok; bal olgunlaşıp sırlanmadan alınmaz.

Seçenekler: 460 g ve 850 g. Saklama: Serin ve kuru yerde saklayın. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('domates-salcasi',
   $kabia$Mevsiminde toplanan domateslerden, geleneksel yöntemle kaynatılan salça. Katkısız, tuz ve domatesten başka bir şey yok. Cam kavanoz.$kabia$,
   $kabia$Mevsiminde toplanan domateslerden, geleneksel yöntemle kaynatılan salça. Katkısız, tuz ve domatesten başka bir şey yok. Cam kavanoz.

Geyve'de Ağustos ortasında domatesler dalında kızarınca toplanır. Sabah serinliğinde elde doğranır, büyük kazanlarda saatlerce ağır ağır kaynatılarak koyulaşır; güneşte kurutulmaz. İçinde domates ve kaya tuzu var. Her kavanozun üzerine hasat haftası yazılır.

Seçenekler: 600 g ve 1 kg. Saklama: Serin ve kuru yerde saklayın. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('elma-sirkesi',
   $kabia$Elma Sirkesi — dost üretici, katkısız, geleneksel.$kabia$,
   $kabia$Elma Sirkesi — dost üretici, katkısız, geleneksel.

Geyve elmalarından, anne usulü. Elmalar sonbaharda tam olgunlaşınca toplanır, yıkanır, doğranır ve doğal fermentasyona bırakılır. Filtre edilmez, tortulu kalır; sirke anası ile birlikte cam kavanozlarda 6 ay dinlenir, sonra süzülmeden şişelenir.

Seçenekler: 500 ml ve 1 L. Saklama: Serin ve kuru yerde. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('eriste',
   $kabia$Erişte — dost üretici, katkısız, geleneksel.$kabia$,
   $kabia$Erişte — dost üretici, katkısız, geleneksel.

Un, yumurta ve tuz — başka bir şey yok. Hamur sabah yoğrulur, oklavayla açılır, yufka olur ve Geyve ovalarında güneşte kurur. Kuruyan yufka elde kesilir, ince şeritler halinde doğranır.

Seçenekler: 500 g ve 1 kg. Saklama: Serin ve kuru yerde. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('findik-ici',
   $kabia$Geyve Setçe Köyü'nde 3. nesil aile bahçesinden kabuklu fındık. Elle toplama, güneşte kurutma. Kimyasal girdiden uzak, aile ölçeği.$kabia$,
   $kabia$Geyve Setçe Köyü'nde 3. nesil aile bahçesinden kabuklu fındık. Elle toplama, güneşte kurutma. Kimyasal girdiden uzak, aile ölçeği.

Bahçe Setçe Köyü'nde, Göktepe'nin yamaçlarında; Engin Abi'nin ailesinin üç nesildir baktığı bahçe. Engin Abi'nin sözleriyle: “Dökülen yaprak, çürüyen dal gübremizdir.”

Seçenekler: 500 g ve 1 kg. Saklama: Serin ve kuru yerde saklayın. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('ihlamur',
   $kabia$Geyve Akıncı Köyü, Haziran hasadı. Sabah serinliğinde elle toplanan ıhlamur çiçekleri, gölgede ağır ağır kurutulur. Katkısız, koruyucusuz — sadece çiçek ve yaprak. Her paket hasat tarihli.$kabia$,
   $kabia$Geyve Akıncı Köyü, Haziran hasadı. Sabah serinliğinde elle toplanan ıhlamur çiçekleri, gölgede ağır ağır kurutulur. Katkısız, koruyucusuz — sadece çiçek ve yaprak. Her paket hasat tarihli.

Toplayan Salih. Ihlamur ağaçları yüksektir; çiçeğe merdiven ve uzun sırıkla ulaşılır. Çiçekler aynı gün gölgede, temiz bezler üzerinde kurutulur. Her paket, hangi gün hangi yamaçtan toplandığı yazılarak kapanır.

Seçenekler: 50 g ve 100 g. Saklama: Serin ve kuru yerde, ağzı kapalı saklayın. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$),
  ('kabuklu-badem',
   $kabia$Kabia Çiftliği'nden organik sertifikalı kabuklu badem. 946 Marinada ağacından hasat. Kabuğunda gölgeli rüzgar alan yerde kurutuldu, katkısız ve hijyenik koşullarda paketlenir. Her paket hasat tarihli. Organik üretimin doğası gereği bademler homojen değildir; kalibre ve büyüklük yıla, ağaca, mevsime göre değişir. İçi boş ya da küçük taneler olabilir — bu bir kusur değil, kimyasal kullanmayan üretimin kendisidir.$kabia$,
   $kabia$Kabia Çiftliği'nden organik sertifikalı kabuklu badem. 946 Marinada ağacından hasat. Kabuğunda gölgeli rüzgar alan yerde kurutuldu, katkısız ve hijyenik koşullarda paketlenir. Her paket hasat tarihli. Organik üretimin doğası gereği bademler homojen değildir; kalibre ve büyüklük yıla, ağaca, mevsime göre değişir. İçi boş ya da küçük taneler olabilir — bu bir kusur değil, kimyasal kullanmayan üretimin kendisidir.

Bahçe Geyve'nin Sabırlar köyünde, Kılıçkaya yamaçlarında 19 dönüm: Kabia Çiftliği'nin kendi bahçesi. Toprağı sürmüyor, otları biçmiyoruz; tüm girdiler doğadan ve kendi bahçemizden: kompost, kompost gübresi ve kompost çayı.

Seçenekler: 500 g, 1 kg ve 2 kg. Saklama: Serin ve kuru yerde saklayın. Raf ömrü: 12 ay.$kabia$),
  ('tarhana',
   $kabia$Tarhana — dost üretici, katkısız, geleneksel.$kabia$,
   $kabia$Tarhana — dost üretici, katkısız, geleneksel.

Domates, kırmızı biber, yoğurt ve un bir araya gelir. Hamur fermente olurken her gün yoğrulur ve havalandırılır; sonra ince serilir, güneşte kurutulur, elle kırılır.

Seçenekler: 500 g ve 1 kg. Saklama: Serin ve kuru yerde. Raf ömrü: 12 ay. Sertifikasız — organik sertifikası bulunmamaktadır.$kabia$)
) AS v(slug, old_description, new_description)
WHERE p.slug = v.slug
  AND p.is_active
  AND p.description = v.old_description;
