import { anchors, routes } from "@/lib/site";

/**
 * Kabia 2.0 — Master Prompt §4 uyumlu homepage copy.
 * Tüm metinler Master Prompt'ta verilen cümlelerden alınmıştır.
 * "Toprağa saygıyla üretilenleri bir araya getiriyoruz." ana cümledir.
 */

export const intro = {
  act1: {
    eyebrow: "Geyve · Sabırlar Köyü — 946 ağaç",
    headlineA: "KABİA",
    headlineB: "Toprağa saygıyla",
    supporting: "Toprağa saygıyla üretilenleri bir araya getiriyoruz. Kendi çiftliğimizden ve güvendiğimiz üreticilerden.",
    primaryCta: { label: "ÇİFTLİĞİ KEŞFET", href: anchors.farm },
    secondaryCta: { label: "SEÇKİYE GÖZ AT", href: routes.store },
  },
  act2: {
    kicker: "Her şey bir badem bahçesinde başladı",
    text: "Kabia'nın hikâyesi, Geyve'nin Sabırlar köyünde kurduğumuz badem bahçesiyle başladı. Bizim için çiftçilik yalnızca ürün yetiştirmek değil; toprağı anlamak, ağacı gözlemlemek ve doğayla birlikte üretmenin yollarını aramak.",
  },
  act3: {
    kicker: "Toprağı sadece üretim alanı olarak görmüyoruz",
    text: "Toprağın canlılığını korumaya, organik maddeyi desteklemeye ve mümkün olduğunca doğanın kendi döngülerinden yararlanmaya çalışıyoruz. Her sezon aynı olmuyor. İklim, toprak, su, hastalıklar ve ağaçlar bize yeniden düşünmeyi öğretiyor.",
  },
  final: { statementA: "Toprağa saygıyla", statementB: "üretiyoruz.", ctaLabel: "Keşfet" },
  sceneDescription: "Gerçek bahçe fotoğrafı — drone zorunlu değil, doğal ışık.",
  transitionWord: "kabia",
  transitionAnnouncement: "kabia — mağazaya yönlendiriliyorsunuz",
} as const;

export const originStory = {
  eyebrow: "Başlangıç",
  title: "Her şey bir badem bahçesinde başladı.",
  body: "Kabia'nın hikâyesi, Geyve'nin Sabırlar köyünde kurduğumuz badem bahçesiyle başladı.\n\nBizim için çiftçilik yalnızca ürün yetiştirmek değil; toprağı anlamak, ağacı gözlemlemek ve doğayla birlikte üretmenin yollarını aramak.\n\nBugün kendi bahçemizde ürettiğimiz bademleri tüketiciyle buluşturuyor, zaman içinde güvendiğimiz başka üreticilerin ürünlerini de Kabia çatısı altında bir araya getiriyoruz.",
  cta: { label: "KABİA'NIN HİKÂYESİ", href: anchors.farm },
} as const;

export const farmFacts = {
  eyebrow: "KABİA ÇİFTLİĞİ",
  title: "Kendi toprağımızdan.",
  intro: "Gerçek bir üretim yeri. Tabeladan değil, topraktan başlayan bir hikâye.",
  facts: [
    { label: "Yer", value: "Sabırlar / Geyve / Sakarya" },
    { label: "Ağaç", value: "946 badem ağacı" },
    { label: "Çeşit", value: "Marinada" },
    { label: "Üretim", value: "Organik" },
  ],
} as const;

export const soilProduction = {
  title: "Toprağı sadece üretim alanı olarak görmüyoruz.",
  body: "Toprağın canlılığını korumaya, organik maddeyi desteklemeye ve mümkün olduğunca doğanın kendi döngülerinden yararlanmaya çalışıyoruz. Her sezon aynı olmuyor. İklim, toprak, su, hastalıklar ve ağaçlar bize yeniden düşünmeyi öğretiyor.",
  pillars: [
    { title: "TOPRAK", description: "Toprağın canlılığını desteklemek." },
    { title: "BİYOÇEŞİTLİLİK", description: "Bahçedeki yaşamı korumak." },
    { title: "DOĞAL YÖNTEMLER", description: "Doğayla uyumlu üretim yöntemlerini araştırmak." },
    { title: "GÖZLEM", description: "Bahçeyi sürekli gözlemleyerek karar vermek." },
  ],
} as const;

export const almondStory = {
  eyebrow: "KABİA BADEMİ",
  title: "Bademimizi tanıyın.",
  intro: "Bir bademin hikâyesi — bahçeden sofraya.",
  meta: ["Marinada", "Geyve / Sakarya", "Kabia Çiftliği", "Organik üretim"],
  steps: [
    { name: "Bahçe", description: "Ağaçlar Kılıçkaya yamaçlarında büyür." },
    { name: "Hasat", description: "Yeşil kabuk çatlayınca toplanır." },
    { name: "Kurutma", description: "Sert kabuğunda, gölgeli rüzgar alan yerde kurur." },
    { name: "Saklama", description: "Serin ve kuru yerde dinlenir." },
    { name: "İşleme", description: "Katkısız hazırlanır." },
    { name: "Paketleme", description: "Kabuklu halde, hijyenik koşullarda paketlenir." },
    { name: "Sofra", description: "Bahçeden çıktığı haliyle size ulaşır." },
  ],
} as const;

export const whyKabia = {
  title: "Neden Kabia?",
  items: [
    { title: "GERÇEK ÜRETİM", description: "Kendi çiftliğimizde üretim yapıyoruz." },
    { title: "ŞEFFAFLIK", description: "Ürünlerin nereden geldiğini anlatıyoruz." },
    { title: "ÜRETİM YÖNTEMİ", description: "Ürünün nasıl üretildiğini önemsiyoruz." },
    { title: "ÜRETİCİ", description: "Sadece ürünü değil, üreticiyi de tanımaya çalışıyoruz." },
    { title: "AZ AMA DOĞRU", description: "Her ürünü satmak yerine arkasında durabileceğimiz ürünleri seçiyoruz." },
  ],
} as const;

export const kabiaSelection = {
  eyebrow: "SEÇKİ",
  title: "Kendi bahçemizin sınırlarının ötesine geçiyoruz.",
  body: "Kabia yalnızca kendi ürettiği ürünlerden oluşan bir marka olmak zorunda değil. Üretim anlayışına güvendiğimiz, mümkün olduğunca yakından tanıdığımız küçük üreticilerin ürünlerini de seçiyoruz.",
  examples: ["Ceviz", "Fındık", "Bal", "Ihlamur", "Salça", "Erişte", "Tarhana"],
  note: "Her ürünün arkasında: Üretici · Bölge · Ürün · Neden Kabia'da?",
} as const;

export const producersPreview = {
  eyebrow: "ÜRETİCİLER",
  title: "Ürünlerin arkasındaki insanları tanıyın.",
  body: "Her ürünün bir üreticisi, bir bölgesi ve bir hikâyesi var.",
  cta: { label: "Üreticileri Keşfet", href: "#ureticiler" },
  producers: [
    { name: "Kabia Çiftliği", region: "Geyve / Sakarya", product: "Badem — Marinada", story: "946 ağaç. Kendi toprağımız, kendi hasadımız.", image: "/images/orchard-hillside.jpg" },
    { name: "Güvendiğimiz Üreticiler", region: "Anadolu'nun farklı köşeleri", product: "Ceviz, fındık, bal ve mutfak ürünleri", story: "Tanıdığımız, üretim yerini bildiğimiz küçük üreticiler. Yakında hikâyeleri burada.", image: "/images/almonds-drying.jpg" },
  ],
} as const;

export const kabiaStandard = {
  title: "Kabia'da her ürün yer almaz.",
  body: "Üreticisini tanımaya çalışırız. Üretim yerini biliriz. Üretim yöntemini sorarız. Kullanılan girdileri önemseriz. Şeffaf olmayan ürünü seçmeyiz.",
  columns: [
    { label: "KABİA ÇİFTLİĞİ", subtitle: "Kendi ürettiğimiz ürünler.", description: "Badem ve badem türevleri. Geyve'deki bahçemizden." },
    { label: "KABİA SEÇKİ", subtitle: "Güvendiğimiz üreticilerden seçtiğimiz ürünler.", description: "Ceviz, fındık, bal, ıhlamur ve mutfak ürünleri. Her birinin hikâyesi ayrı anlatılır." },
  ],
  disclaimer: "Müşteride “Kabia bütün bu ürünleri kendisi mi üretiyor?” sorusu oluşmamalı — bu ayrım sitede kesin ve açıktır.",
} as const;

export const stories = {
  eyebrow: "GÜNLÜK",
  title: "Bahçeden notlar.",
  body: "Her gün içerik yok. Sadece anlatmaya değer gerçek gelişmeler — hasat, mevsim, toprak, gözlem.",
  examples: ["Bugün bahçede…", "Hasada hazırlanıyoruz.", "Bu yıl badem bahçesinde…", "Toprakta bugün…"],
} as const;

export const hardSeasons = {
  title: "Çiftçilik her zaman istediğimiz gibi gitmez.",
  body: "Don, kuraklık, hastalık — gerçek üretim hayatında zor sezonlar da var. Saklamıyoruz, dramatize de etmiyoruz. Bu şeffaflık markaya gerçeklik ve güven kazandırır.",
} as const;

export const editorialImage = {
  src: "/images/almonds-drying.jpg",
  width: 2200,
  height: 1466,
  alt: "Hasat edilmiş kabuklu bademler",
  caption: "Hasat sonrası. Bademler kabuğunda, kendi halinde kurur.",
} as const;

export const quote = {
  text: "Doğanın bize sunduğu en değerli hediyelerden biri olan bademi, en saf ve doğal haliyle sizlere ulaştırıyoruz.",
  attribution: "Kabia Ekolojik",
  context: "Kuruluş metninden",
} as const;

export const finalCta = {
  titleA: "Bu hasadın bademini",
  titleB: "birlikte tadalım.",
  body: "Kendi çiftliğimizden ve güvendiğimiz üreticilerden — seçkiye göz atın veya bize yazın.",
  cta: { label: "Mağazaya Git", href: routes.store },
  image: { src: "/images/almonds-net.jpg", alt: "File içinde kabuklu Kabia bademleri" },
} as const;

// — Geriye dönük uyumluluk: eski componentler için aliaslar (build kırılmasın) —
export const manifesto = {
  statementA: "Badem aceleye gelmez;",
  statementB: "biz de acele etmiyoruz.",
  body: "Kabia Ekolojik, Geyve'nin dağ köyü Sabırlar'da badem yetiştirir. Bahçeye kimyasal gübre ve ilaç girmez; ürüne katkı maddesi eklenmez. Az ama doğru üretmeyi tercih ediyoruz.",
} as const;

export const origin = {
  title: "Çiftlik",
  eyebrow: "Sabırlar Köyü — Geyve, Sakarya",
  body: [
    "Bahçelerimiz Sakarya'nın Geyve ilçesinde, Sabırlar köyünün yamaçlarında. Badem burada dört mevsimi de görür: baharda çiçek, yazda yeşil kabuk, sonbaharda hasat, kışta uyku.",
    "Üretimi başkasına devretmiyoruz. Ağaçların bakımı, hasat ve kurutma bizim elimizden geçer; bölge çiftçileriyle birlikte çalışırız.",
  ],
  images: [
    { src: "/images/orchard-hillside.jpg", width: 2047, height: 2048, alt: "Geyve sırtlarında genç badem bahçesi", caption: "Genç bahçe, Geyve sırtları." },
    { src: "/images/field-tractor.jpg", width: 1200, height: 1600, alt: "Bahçe bakımı", caption: "Bahçe bakımı bize ait." },
    { src: "/images/orchard-winter.jpg", width: 2048, height: 2048, alt: "Kış bahçesi", caption: "Kış — bahçe uykuda." },
  ],
} as const;

export const principles = {
  title: whyKabia.title,
  items: whyKabia.items.map((i) => ({ name: i.title, description: i.description })),
} as const;

export const process = {
  title: almondStory.title,
  intro: almondStory.intro,
  steps: almondStory.steps.slice(0, 6).map((s, i) => ({
    name: ["Bahçe", "Hasat", "Ayıklama", "Kurutma", "Hazırlık", "Sofra"][i] ?? s.name,
    description: s.description,
  })),
} as const;

export const products = {
  title: "Ürünler",
  intro: "Tek kaynak: Geyve'deki bahçelerimiz. Öne çıkan ürünler aşağıda; tamamı mağazada.",
} as const;

// — AŞAMA 3 — Hikayenin siteye dağılımı (kısa versiyonlar, ana sayfa için) —
export const asama3Baslangic = {
  eyebrow: "Başlangıç",
  title: "Her şey bir badem ağacıyla başlamadı.",
  subtitle: "Toprağa başka türlü bakmaya karar vermekle başladı.",
  body: "2021 yılında Geyve Kılıçkaya eteklerinde Kabia Ekolojik Çiftliği'ni kurduk. Bir bahçe kurmak istedik. Ama yalnızca ağaçların büyüdüğü bir bahçe değil; toprağın canlılığını koruyabildiğimiz, doğanın döngülerini gözlemleyebildiğimiz ve ürettiğimiz gıdanın arkasında güvenle durabileceğimiz bir yer.",
  cta: { label: "Kabia'nın hikâyesi →", href: "/ciftlik" },
} as const;

export const asama3UcDunya = {
  ciftlik: {
    title: "KABİA ÇİFTLİĞİ",
    subtitle: "Bizim toprağımızdan.",
    desc: "Kabia'nın kendi üretimi. Organik tarım sertifikalı.",
    cta: { label: "Çiftliği keşfet →", href: "/ciftlik" },
  },
  secki: {
    title: "KABİA SEÇKİ",
    subtitle: "Tanıdığımız üreticilerden.",
    desc: "Üreticisini tanıdığımız ve üretim biçimine güvendiğimiz ürünler.",
    examples: "Ceviz · Fındık · Bal · Ihlamur",
    cta: { label: "Seçkiyi keşfet →", href: "/secki" },
  },
  mutfak: {
    title: "KABİA MUTFAK",
    subtitle: "Üreticilerin mutfağından.",
    desc: "Üretimine ve üreticisine güvendiğimiz geleneksel mutfak ürünleri.",
    examples: "Erişte · Tarhana · Sirke · Salça · Reçel",
    cta: { label: "Kabia Mutfağı keşfet →", href: "/mutfak" },
  },
} as const;

export const asama3Toprak = {
  title: "Önce toprağı düşündük.",
  body: "Bizim için tarımın başlangıcı bitki değil, topraktır. Toprağı yalnızca üretim yaptığımız bir zemin olarak değil, yaşayan bir ekosistem olarak görüyoruz. Ekolojik ve biyolojik tarım tekniklerinden yararlanıyor; toprağın ve bitkilerin biyolojik yaşamını desteklemeye çalışıyoruz.",
  cta: { label: "Nasıl üretiyoruz? →", href: "/uretim" },
} as const;

export const asama3Badem = {
  title: "Bir badem,",
  subtitle: "bir yılın hikâyesidir.",
  facts: [
    { label: "Ağaç", value: "946 ağaç" },
    { label: "Çeşit", value: "Marinada" },
  ],
  body: "Çiçeklenmeden hasada kadar geçen uzun bir yol. Toprak, kökler, yağmur, güneş, arılar, rüzgâr, soğuk ve sabır... Bir ağacın büyümesini izlemek bize beklemeyi ve gözlemlemeyi öğretti.",
  cta: { label: "Badem bahçesini keşfet →", href: "/badem" },
} as const;

export const asama3Doga = {
  title: "Doğayı kontrol edemeyiz.",
  subtitle: "Ama onu dinleyebiliriz.",
  body: "Yağmuru yönetemeyiz. Rüzgârı durduramayız. Bazen bir gecelik don, aylarca verdiğimiz emeği değiştirebilir. Biz bunu yaşadık. Ama çiftçilik bize şunu öğretti: Tarım, doğaya karşı verilen bir mücadele değil; doğayla birlikte üretmenin yollarını arama işi.",
  cta: { label: "Çiftlikten hikâyeler →", href: "/ciftlikten" },
} as const;

export const asama3Ureticiler = {
  title: "Bir ürünün arkasında",
  subtitle: "çoğu zaman bir insan vardır.",
  body: "Kabia'nın hikâyesi yalnızca kendi bahçemizle sınırlı değil. Çevremizde aynı özeni gösteren üreticileri tanımaya başladık. İyi üretimin başka biçimlerini gördük. Bu nedenle tanıdığımız ve güvendiğimiz üreticilerin ürünlerini de Kabia'ya taşıyoruz.",
  cta: { label: "Üreticileri tanıyın →", href: "/ureticiler" },
} as const;

export const asama3Sofra = {
  title: "Kendi soframıza koymayacağımızı",
  subtitle: "sizin sofranıza göndermiyoruz.",
  body: "Bir ürünü seçerken kendimize önce tek bir soru soruyoruz: “Bunu kendi soframıza koyar mıydık?” Cevabımız evetse, sizin sofranıza da taşımak istiyoruz.",
} as const;
