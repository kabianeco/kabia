/**
 * Kabia's field journal: dated notes from the orchard — location,
 * weather, orchard state, what was applied, what was observed, what came of
 * it. This is not a database table: entries are written by hand and added
 * here directly, the same way content/homepage.ts holds hand-written site
 * copy rather than reading from Supabase.
 *
 * The three March 2026 entries below are starter notes in the final format —
 * replace their details with the real field log as it happens. `slug`
 * becomes the /gunluk/[slug] URL and must be unique.
 */

export interface JournalEntry {
  slug: string
  /** ISO date, e.g. "2026-03-14". */
  date: string
  location: string
  weather: string
  orchardState: string
  application: string
  observation: string
  outcome: string
  /** Optional photo, e.g. "/images/gunluk-2026-03-07.jpg". */
  photo?: string
  /** Optional video (keep small, plays on tap), e.g. "/images/gunluk-2026-03-15.mp4". */
  video?: string
}

export const journalEntries: JournalEntry[] = [
  {
    slug: "2026-04-11-tomurcuk-cicek",
    date: "2026-04-11",
    location: "Kabia Çiftliği",
    weather: "Parçalı bulutlu 15°",
    orchardState: "Tomurcuklar patlıyor, ilk çiçekler açıyor",
    application: "Yok — sadece gözlem",
    observation: "Dallar tomurcuktan çiçeğe dönüyor; bahçe beyaza bürünmeye başladı.",
    outcome: "Arılar bekleniyor — çiçeklenme takipte.",
    photo: "/images/gunluk-2026-04-11-mayis-tomurcuk.jpeg",
  },
  {
    slug: "2026-04-07-mavi-legen",
    date: "2026-04-07",
    location: "Kabia Çiftliği",
    weather: "Açık 18°",
    orchardState: "Örtü bitkileri ve baklalar yeşeriyor",
    application: "Mavi leğen tuzakları yerleştirildi",
    observation: "Tropinota hirta'ya karşı zehirsiz nöbet başladı: su dolu mavi leğenler sıralara kondu.",
    outcome: "Erginler çiçeklerle beslenerek ürün kaybına yol açar, bu yüzden mavi leğen uygulaması yapıyoruz — bahçede zehir kullanılmıyor, doğa kendi dengesini kuruyor.",
    photo: "/images/gunluk-2026-04-10-bakla.jpeg",
  },
  {
    slug: "2026-04-01-tomurcuk",
    date: "2026-04-01",
    location: "Kabia Çiftliği",
    weather: "Açık 16°",
    orchardState: "Ağaçlar uyanıyor, dallar canlanıyor",
    application: "Yok — sadece gözlem",
    observation: "Meyve gözleri yavaş yavaş kabarıyor; bahçe uyanmaya başladı.",
    outcome: "Çiçeklenme bekleniyor — gözler dallarda.",
    photo: "/images/gunluk-2026-04-01-tomurcuk.jpeg",
  },
  {
    slug: "2026-03-15-kaolin",
    date: "2026-03-15",
    location: "Kabia Çiftliği",
    weather: "Parçalı bulutlu 13°",
    orchardState: "Tomurcuklar kabarıyor, ilk ilaçsız koruma zamanı",
    application: "Doğal kil (kaolin) uygulaması",
    observation: "Dallara ince kil perdesi çekildi; zararlıya karşı zehirsiz kalkan.",
    outcome: "Koruma tamam — gözlem sürüyor.",
    video: "/images/gunluk-2026-03-15-kaolin.mp4",
  },
  {
    slug: "2026-02-25-kis-gunu",
    date: "2026-02-25",
    location: "Kabia Çiftliği",
    weather: "Güneşli 4°",
    orchardState: "Bahçe kar altında, ağaçlar uykuda",
    application: "Yok — sadece kontrol",
    observation: "Kar üstünde sadece bizim ayak izlerimiz; dallar çıplak, kökler sıcak.",
    outcome: "Kış uykusu sürüyor — bahar bekleniyor.",
    photo: "/images/gunluk-2026-03-01-subat-kis.jpeg",
  },
  {
    slug: "2026-09-13-catlak-kabuk",
    date: "2026-09-13",
    location: "Kabia Çiftliği",
    weather: "Açık 26°",
    orchardState: "Dış kabuk çatlamaya başladı",
    application: "Yok — sadece gözlem",
    observation: "Dış kabuk çatlamaya başladı; ama hasat için biraz daha zaman var gibi.",
    outcome: "Takip sürüyor — çatlama tamamlanınca hasat.",
    photo: "/images/catlakkabuk.jpg",
  },
  {
    slug: "2026-08-25-yesil-kabuk",
    date: "2026-08-25",
    location: "Kabia Çiftliği",
    weather: "Açık 28°",
    orchardState: "Dış kabuklar yeşil, çatlama henüz yok",
    application: "Yok — sadece gözlem",
    observation: "Bademler dalda yeşil kabuğunda duruyor; çatlama başlamadı.",
    outcome: "Hasat için erken — takip sürüyor.",
    photo: "/images/yesilbadem.jpg",
  },
]
