export type ProducerStory = {
 slug: string;
 name: string;
 region: string;
 badge: string;
 image: string;
 desc: string;
 tags: string[];
 harvest: string;
 price: string;
 note: string;
 story: string; // placeholder — sonra gerçek hikâye ile değiştirilecek
 quote: string;
};

export const PRODUCER_STORIES: ProducerStory[] = [
 {
 slug: "kabia-ciftligi",
 name: "Kabia Çiftliği",
 region: "Sabırlar · Geyve / Sakarya",
 badge: "ANA ÇİFTLİK · ORGANİK",
 image: "/images/orchard-hillside.jpg",
  desc: "946 badem ağacı. Organik tarım sertifikalı.",
 tags: ["Marinada", "Orman kompostu", "JADAM"],
 harvest: "Eylül Hasadı — Sınırlı",
 price: "1 kg · ₺680",
 note: "Sert kabuğunda güneşte kurutma, katkısız.",
  story: `Kabia Çiftliği'nde her şeyden önce toprağı düşündük. Bizim için tarımın başlangıcı ağaç değil, toprak. Toprağın içindeki milyonlarca canlıyı — bakterileri, mantarları, yararlı fungusları — çoğaltmak; toprağı yeniden yaşayan bir ekosistem haline getirmek asıl işimiz. Önce toprağı iyileştirmeye çalışıyoruz. Canlanan, gelişen toprak ağaçları zaten kendisi besleyip büyütüyor.

Dışarıdan hiçbir girdi yok. Organik üretimde kullanımı sertifikalı olsa bile, gübre anlamında bahçeye hiçbir şey almıyoruz. Otları biçmiyoruz, toprağı sürmüyoruz. Doğayı kontrol etmeye değil, taklit etmeye çalışıyoruz; üretimimizi doğanın kendi döngüsüne emanet ediyoruz. Tüm girdilerimiz doğadan ve kendi bahçemizden: kompost, kompost gübresi ve kompost çayı.

946 Marinada ağacı. Her hasat, toprağa verdiğimiz emeğin karşılığı — bir yılın değil, yılların hikâyesi.`,
  quote: "Toprağa iyi bakarsanız, toprak da size iyi bakar.",
 },
  {
    slug: "geyce-setce-findik",
    name: "Geyve — Setçe Köyü Aile Bahçesi",
    region: "Geyve / Setçe Köyü — 3. nesil, Aile bahçesi",
    badge: "DOST ÜRETİCİ",
    image: "/images/findik1.jpeg",
    desc: "Yamaç bahçelerinde elle toplama, güneşte kurutma.",
    tags: ["Elle hasat", "Güneşte kurutma", "Aile ölçeği"],
    harvest: "",
    price: "1 kg · ₺520",
    note: "",
    story: `Göktepe’nin Eteğinde Üç Nesillik Bir Miras — Kabia ekosisteminde her üreticinin bir hikayesi, her toprağın bir hafızası vardır. Setçe Köyü’nün Sisli Göktepe dağ yamaçlarına vardığınızda, yeşilin en derin tonuyla karşılar sizi Engin Abi’nin bahçesi. Burası sadece fındık ağaçlarının dizildiği bir arazi değil; üç nesildir kimyasal tek bir damla zehir girmemiş, mantar ağının ve toprak altı canlılığının özgürce nefes aldığı canlı bir orman ekosistemidir.

Biz Kabia olarak toprağı sürmeden, onu sentetik gübrelerle zorlamadan, doğanın kendi dengesini koruyarak üretim yapmanın peşindeyiz. Engin Abi de bu felsefeyi Göktepe’nin sert ama cömert coğrafyasında yıllardır bizzat yaşayan, toprağın kadim bilgesidir.

Engin Abi’nin Ağzından: “Biz Toprağa Efendi Olmaya Değil, Çırak Olmaya Geldik”

“Bu dağın yamacında dedem fındık toplarken de sis aynı böyle çökerdi. Ben bu bahçede büyüdüm, çocukluğum ocak diplerindeki yaprak kompostlarının içinde geçti.

‘Millet ilacı basıyor, sen neden kullanmıyorsun?’ diye soruyorlar. Dedem zehirsiz teslim etti, babam tek gram suni gübre atmadan büyüttü. İki çuval fazla için Göktepe’nin canlısını nasıl zehirleyeyim?

Biz zehir atmayız. Dökülen yaprak, çürüyen dal gübremizdir. Ağacın suyunu, rüzgarını doğru okursan hakkını verir. Bizim fındığın tadı bundandır; kimyasal değil, Göktepe’nin rüzgarı kalır.”

Not: Engin Abi’nin bahçesi organik sertifikalı değil, doğal üretimdir — yerinde gördüğümüz, tanıdığımız üretim.`,
    quote: "Hızlı değil, doğru hasat.",
  },
 {
 slug: "ege-ceviz",
 name: "Gediz — Ege Ceviz Bahçesi",
 region: "Manisa / Gediz Havzası — 20 yaş",
 badge: "DOST ÜRETİCİ",
 image: "/images/valley-ridge.jpg",
 desc: "Gediz ovasına bakan yaşlı ceviz bahçesi.",
 tags: ["Toprak analizi", "Gölgede kurutma"],
 harvest: "Ekim Hasadı — 28kg",
 price: "1 kg · ₺590",
 note: "Kabuklu, el ayıklaması.",
 story: `Gediz Havzası'na bakan yirmi yaşında ceviz bahçesi. Toprak her yıl analize gider, budama elle yapılır, hasat sonrası cevizler gölgede, tel ızgaralarda kurutulur. Acele yok; kabuk çatlamadan, içi tam kurumadan çuvala girmez. Bahçe sahibi, "Ceviz sabır ister" der. (PLACEHOLDER — gerçek üretici hikâyesi ile değiştirilecek)`,
 quote: "Ceviz sabır ister.",
 },
  {
   slug: "anadolu-bal",
   name: "Kılıçkaya Vadisi — Sabırlar Kayadibi",
   region: "Sabırlar Kayadibi, Kılıçkaya Vadisi — Sabit kovan",
   badge: "DOST ÜRETİCİ",
   image: "/images/field-tractor.jpg",
   desc: "Gezgin değil, sabit kovan. Aynı flora, aynı rakım.",
   tags: ["Sabit kovan", "Olgun hasat"],
   harvest: "",
   price: "460g · ₺420",
   note: "",
   story: `Kılıçkaya Vadisi'nde, Sabırlar Kayadibi'nde sabit kovanlar. Arıcı gezgin değil; aynı rakım, aynı flora, aynı kovan yeri. Bal olgunlaşmadan, sırlanmadan alınmaz. "Arı ne topladıysa o" der arıcı, şeker yok, erken hasat yok. (PLACEHOLDER — gerçek arıcı hikâyesi ile değiştirilecek)`,
   quote: "Arı ne topladıysa o.",
   },
  {
   slug: "akinci-ihlamur",
   name: "Geyve — Akıncı Köyü Ormanı",
   region: "Geyve / Akıncı Köyü — Orman, 700 m",
   badge: "DOST ÜRETİCİ",
   image: "/images/ihlamur.jpeg",
   desc: "Haziran sabahı, orman içi elle toplama, gölgede kurutma.",
   tags: ["Elle toplama", "Gölgede kurutma", "Orman"],
   harvest: "Haziran Hasadı — Sınırlı",
   price: "50g · ₺240",
   note: "Sadece çiçek ve yaprak, katkısız.",
   story: `Geyve Akıncı Köyü’nün ormanlarında, Haziran’ın ilk sıcaklarıyla ıhlamurlar açar. Sabah serinliği varken, çiçek henüz tam kurumamışken toplanır — öğle sıcağı beklenmez, çünkü uçucu yağ o saatlerde uçar.

Aile, ormanın bildiği patikalarından girer, tek tek elle toplar; dal kırılmaz, ağaç yorulmaz. Toplanan çiçekler aynı gün harmanda değil, gölgede, temiz bezler üzerinde ağır ağır kurutulur. Güneşte değil — gölgede, çünkü ıhlamurun rengi ve kokusu gölgede saklanır.

Biz Kabia’da ıhlamuru ıhlamur olduğu için severiz: ne aroma verici, ne koruyucu. Sadece çiçek ve yaprak. Her paket, hangi gün, hangi orman yamacından toplandığı yazılarak kapanır. (PLACEHOLDER — gerçek Akıncı hikâyesi ile değiştirilecek)`,
   quote: "Ihlamur sabahı sever.",
   },
 {
 slug: "domates-salcasi",
 name: "Domates Salçası",
 region: "Geyve — Mevsiminde",
 badge: "MUTFAK · Geleneksel",
 image: "/images/almonds-net.jpg",
 desc: "Mevsiminde olgunlaşan domatesler, güneşte ağır ağır kurutulur.",
 tags: ["Güneşte kurutma", "Cam kavanoz", "Katkısız"],
 harvest: "Yaz Hasadı — Ağustos",
 price: "450g · ₺180",
 note: "Elde doğranmış, taş fırın yüzeyinde.",
 story: `Geyve'de yaz sonu domatesleri tam olgunlaşınca toplanır, odun ateşinde değil, güneşte ağır ağır koyulaşır. Sadece domates ve tuz; koruyucu yok, hızlandırıcı yok. Geleneksel yöntemle, cam kavanozda saklanır. Her kavanozun üzerine hasat haftası yazılır. (PLACEHOLDER — gerçek mutfak hikâyesi ile değiştirilecek)`,
 quote: "Mevsiminde olan, mevsiminde yapılır.",
 },
 {
 slug: "elma-sirkesi",
 name: "Elma Sirkesi",
 region: "Geyve — Doğal Fermentasyon",
 badge: "MUTFAK · Doğal",
 image: "/images/orchard-hillside.jpg",
 desc: "Geyve'nin elmalarından, annelerimizin yaptığı gibi.",
 tags: ["Doğal fermentasyon", "Tortulu", "6 ay"],
 harvest: "Dört mevsim — Sabırla",
 price: "500ml · ₺150",
 note: "Annesinin sirkesi, torunun lezzeti.",
 story: `Geyve elmalarından, anne usulü. Doğal fermentasyon, filtre edilmez, tortulu kalır. Sirke anası ile birlikte 6 ay dinlenir, sonra süzülmeden şişelenir. Hızlı sirke değil, sabır sirkesi. (PLACEHOLDER — gerçek mutfak hikâyesi ile değiştirilecek)`,
 quote: "Sirke sabır ister.",
 },
 {
 slug: "eriste",
 name: "Erişte",
 region: "Geyve — Elde Kesme",
 badge: "MUTFAK · Geleneksel",
 image: "/images/field-tractor.jpg",
 desc: "Un, yumurta ve tuz. Ovalarda kurutulan yufka, elle kesilir.",
 tags: ["Elde kesme", "Güneşte kurutma", "Yumurtalı"],
 harvest: "Sonbahar — Ekim",
 price: "500g · ₺140",
 note: "Makine yok, elle kesme, doğal kurutma.",
 story: `Un, yumurta, tuz ve sabır. Hamur açılır, yufka olur, ovalarda güneşte kurur, sonra elle kesilir. Makine yok, acele yok. Geleneksel mutfakta, aynı tezgahta yıllardır aynı eller keser. (PLACEHOLDER — gerçek mutfak hikâyesi ile değiştirilecek)`,
 quote: "Makine yok, el var.",
 },
 {
 slug: "tarhana",
 name: "Tarhana",
 region: "Geyve — Geleneksel",
 badge: "MUTFAK · Geleneksel",
 image: "/images/almonds-drying.jpg",
 desc: "Domates, biber, yoğurt ve un. Geleneksel tarhana fermantasyonu.",
 tags: ["Fermantasyon", "Güneşte kurutma", "Elle kırma"],
 harvest: "Sonbahar — Ekim-Kasım",
 price: "500g · ₺160",
 note: "3 gün fermentasyon, sonra güneş ve zaman.",
 story: `Domates, biber, yoğurt ve un bir araya gelir, 3-4 gün fermente olur. Sonra güneşte kurutulur, elle kırılır, toz olur. Kışın çorbası, yazın emeği. Her tarhana aynı tarife değil, aynı mutfağın eline aittir. (PLACEHOLDER — gerçek mutfak hikâyesi ile değiştirilecek)`,
 quote: "Zaman, tarhananın mayasıdır.",
 },
];
