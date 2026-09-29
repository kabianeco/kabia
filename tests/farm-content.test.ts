import assert from "node:assert/strict"
import { describe, it } from "node:test"

const farmContent = await import("../content/farm.ts").catch(() => ({
  farmOpening: undefined,
  farmPrinciples: undefined,
  farmTimeline: undefined,
}))

const expectedTimeline = [
  {
    id: "2021",
    year: "2021",
    eyebrow: "2021 TEMMUZ — 946 FİDAN TOPRAKLA BULUŞTU",
    heading: "946 çukur, 946 söz.",
    paragraphs: [
      "2019’da dinlediğimiz o boş yamaç, iki yaz sonra Temmuz sıcağında tek tek can buldu. Her çukur elle açıldı, her Marinada kökleri incitmeden yerleştirildi, can suyu aynı gün verildi. “Olmaz” denilen yamaç, o gün ilk kez bahçe oldu.",
      "O yaz suyu değil, sabrı konuştuk. Tutmayan fidanı gece suladık, tutanı sessizce izledik. 946 fidan aynı anda büyümedi — kimi erken uyandı, kimi bir mevsim bekledi. Ama hepsi aynı toprağı paylaştı, aynı rüzgarı duydu. Bu dikim bir hasat değil, bir emanetin toprağa bırakılışıydı.",
    ],
    image: "/images/ilkdikim.jpg",
    imageAlt: "2021 Temmuz — 946 Marinada fidan dikimi",
  },
  {
    id: "2022",
    year: "2022",
    eyebrow: "2022 MAYIS — BAHÇE UYANDI",
    heading: "Bir kış sonra, yamaç yeşile durdu.",
    paragraphs: [
      "Temmuz’un çelimsiz fidanları bir kışı atlatıp Mayıs’ta taze sürgün verdi. Önde tek bir Marinada, arkasında sıra sıra genç ağaçlar — hepsi kazıklarında, rüzgarla birlikte salınıyor. Altlarında biçmediğimiz otlar ve ilk kır çiçekleri: örtüyü korumanın, toprağa emaneti hatırlatmanın sessiz ödülü.",
      "O bahar hiçbir fidanın yerini değiştirmedik. Sadece izledik. Hangisinin erken uyandığını, hangisinin rüzgarda yattığını not ettik. Bahçe bize acele etmemeyi öğretiyordu — bir yıl sonra artık boş bir tarla değil, nefes alan bir yamaç vardı Kılıçkaya’da.",
    ],
    image: "/images/marinada-2022.jpeg",
    imageAlt: "2022 Mayıs — Bahçenin genel görünümü, Kılıçkaya",
  },
  {
    id: "2023",
    year: "2023",
    eyebrow: "2023 TEMMUZ — AĞAÇ KENDİNİ GÖSTERDİ",
    heading: "İki yaz sonra, dal sürgün verdi.",
    paragraphs: [
      "Temmuz 2023, ikinci yaz. Önde tek bir Marinada artık çelimsiz değil — boy verdi, yan dallar açtı, yaprakları rüzgarla birlikte gölge yapıyor. Altında yine biçmediğimiz otlar, bu kez mavi ve sarı kır çiçekleriyle karışık. Arkada sıra sıra diğer ağaçlar da aynı ritimde, biri erken, biri geç ama hepsi ayakta.",
      "O yaz ilk kez budamayı değil, dallanmayı konuştuk. Hangi dalın güneşi gördüğünü, hangisinin gölgede kaldığını izledik. Toprak artık daha koyu, daha nemli, daha canlı — orman kompostu ve kompost çayının izi. Bahçe bize şunu hatırlattı: ağaç acele etmez, kök zaman ister.",
    ],
    image: "/images/marinada-2023.jpeg",
    imageAlt: "2023 Temmuz — 2. yılda Marinada gelişimi",
  },
  {
    id: "2024",
    year: "2024",
    eyebrow: "2024 OCAK — BAHÇE UYKUDA",
    heading: "Kar altında, sabır çalışır.",
    paragraphs: [
      "Ocak 2024, Kılıçkaya bembeyaz. 946 Marinada karın altında usul usul bekliyor — dalları çıplak ama kökleri sıcak. Toprak donmuyor, çünkü yıllardır sürmediğimiz, biçmediğimiz o örtü karı koynunda tutuyor. Tepede sis, yamaçta sadece bizim ayak izlerimiz ve sessizlik.",
      "Dışarıdan bakan “kışın ne işin var bahçede” der. Var. Eğilen kazığı düzeltmek, karın yükünü hafifletmek, sessizce kontrol etmek. Eller üşür ama içimiz sıcaktır. Çünkü biliriz — ağaç uyurken bile kök çalışır. Bahçe en çok kışın öğretir: hiçbir şey yokmuş gibi görünen o bembeyazlıkta, aslında bir sonraki bahar usul usul hazırlanır. Biz de toprak gibi bekleriz, acele etmeden.",
    ],
    image: "/images/marinada-2024.jpeg",
    imageAlt: "2024 Ocak — Kış günü, bahçe uykuda",
  },
  {
    id: "2025-early-spring",
    year: "2025",
    substep: "Erken bahar",
    eyebrow: "2025 MART — DOĞA ERKEN UYANDI",
    heading: "Hava sıcaktı, bahçe sabredemedi.",
    paragraphs: [
      "Mart 2025, hava normalden sıcaktı. Kılıçkaya’da kış erken çekildi, bahçe erken uyandı. Önde tek bir Marinada bembeyaz çiçeklerle kaplı — arkasında sıra sıra diğerleri, hepsi aynı heyecanla. Yamaç bir anda gelin gibi açtı.",
      "O çiçekleri görünce hem sevindik hem içimiz burkuldu. Çünkü biliyorduk — erken uyanan bahçe, ayaza daha açıktır. Yine de o anı sevdik. Bademin çiçeği narindir, bir rüzgar ister, bir arı bekler. Biz de bekledik, sessizce. Doğa acele ettirmişti, biz ona eşlik ettik — endişeyle, umutla, içten içe.",
    ],
    image: "/images/marinada-2025-ilkcicek.jpeg",
    imageAlt: "2025 Mart — Erken uyanan bahçe, ilk çiçekler",
  },
  {
    id: "2025-frost",
    year: "2025",
    substep: "Don",
    eyebrow: "18 MART 2025 — ÇİÇEKTEN DONA",
    heading: "Dört gün, dört gece — tam çiçekte yakalandık.",
    paragraphs: [
      "18 Mart’ta hava döndü. Dört gün süren soğuk ve kar, tam da ağaçlar çiçekteyken geldi. Bir hafta önce bembeyaz açan dallar, bir sabah kahverengiye döndü — çiçekler kavrulmuş, arılar gelmeden donmuştu. Yerde kar, dalda buz, içimizde sessizlik.",
      "O 4 gün boyunca sobayı değil, bahçeyi düşündük. Yapacak bir şey yoktu — doğa kararını vermişti. Erken uyanmanın bedeli, tam çiçekte yakalanmaktı. O yıl hasat beklemedik, toprağı dinlendirdik. Kayıp gibi görünen o don, bize en içten dersi verdi: emanet bazen beklemeyi, hatta vazgeçmeyi de bilmektir.",
    ],
    image: "/images/marinada-2025-don.jpeg",
    imageAlt: "2025 18 Mart — 4 gün süren don, çiçekte yakalandı",
  },
  {
    id: "2026",
    year: "2026",
    substep: "Yeni sezon",
    eyebrow: "2026 — YENİ SEZON",
    heading: "Notlar hazır, bahçe uyanıyor.",
    paragraphs: [
      "Yeni sezon. Notlarımız hazır: kompost sıraları, çay takvimi, çiçeklenme gözlemleri. Bu yılın hasadı, bu notlarla başlıyor.",
      "Kompost sıraları serili, çay takvimi duvarda, gözlem defteri açık. Yeni sezonun ilk işi toprağa dokunmak değil, not almak — bahçe ne derse onu yapacağız.",
    ],
    image: "/images/orchard-hillside.jpg",
    imageAlt: "2026 — Yeni sezon, Kılıçkaya yamaçları",
  },
] as const

describe("farm source content", () => {
  it("keeps the focused stewardship opening from emanet", () => {
    assert.deepEqual(farmContent.farmOpening, {
      eyebrow: "Emanet",
      title: "Toprağı emanet gibi görüyoruz.",
      body: "Bu toprak bize ait değil. Bizden sonrakilere bırakacağımız bir emanet. Hızlı değil, doğru ve kalıcı üretmek — her hasat bir sonraki yılın toprağına bırakılan nottur.",
    })
  })

  it("keeps all six emanet principles verbatim and in order", () => {
    assert.deepEqual(farmContent.farmPrinciples, [
      "Önce toprak, sonra ağaç.",
      "Toprağı sürmüyoruz.",
      "Otları biçmiyoruz.",
      "Tüm girdiler doğadan ve kendi bahçemizden: kompost, kompost gübresi, kompost çayı.",
      "Doğayı kontrol etmiyoruz, taklit ediyoruz.",
      "Her paket hasat tarihli — ne zaman, nereden, kimden.",
    ])
  })

  it("keeps the seven approved ciftlikten timeline states with their matched copy and photos", () => {
    assert.deepEqual(farmContent.farmTimeline, expectedTimeline)
  })

  it("keeps two source paragraphs in every timeline state", () => {
    assert.ok(Array.isArray(farmContent.farmTimeline))
    for (const state of farmContent.farmTimeline) {
      assert.equal(state.paragraphs.length, 2, state.id)
      assert.ok(state.paragraphs.every((paragraph: string) => paragraph.length > 0), state.id)
    }
  })

  it("includes only the approved years and ordered 2025 substeps", () => {
    assert.ok(Array.isArray(farmContent.farmTimeline))
    assert.deepEqual(
      farmContent.farmTimeline.map((state) => [state.year, state.substep ?? null]),
      [
        ["2021", null],
        ["2022", null],
        ["2023", null],
        ["2024", null],
        ["2025", "Erken bahar"],
        ["2025", "Don"],
        ["2026", "Yeni sezon"],
      ],
    )
  })

  it("does not mix in the old emanet year notes", () => {
    assert.ok(Array.isArray(farmContent.farmTimeline))
    const serialized = JSON.stringify(farmContent.farmTimeline)
    for (const excluded of [
      "Toprağı devraldık. Yorgundu, biz acemiydik.",
      "Sürümü bıraktık.",
      "Kompost çayı uygulamaları başladı.",
      "JADAM killi koruma",
    ]) {
      assert.equal(serialized.includes(excluded), false, excluded)
    }
  })
})
