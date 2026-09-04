import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}
const supa = createClient(url, key);

// 1. Ensure categories exist
const neededCats = [
  { name: "Kabuklu Badem", slug: "kabuklu-badem" },
  { name: "Ceviz", slug: "ceviz" },
  { name: "Fındık", slug: "findik" },
  { name: "Bal", slug: "bal" },
  { name: "Salça", slug: "salca" },
  { name: "Sirke", slug: "sirke" },
  { name: "Erişte", slug: "eriste" },
  { name: "Tarhana", slug: "tarhana" },
];

for (const c of neededCats) {
  const { data: existing } = await supa.from("categories").select("id").eq("slug", c.slug).maybeSingle();
  if (!existing) {
    const { error } = await supa.from("categories").insert(c);
    console.log(`cat ${c.slug}:`, error ? `ERR ${error.message}` : "inserted");
  } else {
    console.log(`cat ${c.slug}: exists`);
  }
}

// 2. Helper to get category id
async function getCatId(slug) {
  const { data } = await supa.from("categories").select("id").eq("slug", slug).single();
  return data.id;
}

// 3. Products to ensure
const products = [
  {
    slug: "kabuklu-badem",
    name: "Kabuklu Badem",
    cat: "kabuklu-badem",
    short: "Organik sertifikalı — kabuklu, güneşte kurutma — 775m",
    desc: "Kabia Çiftliği'nden organik sertifikalı kabuklu badem. 775m rakımda, 946 Marinada ağacından hasat. Sert kabuğunda güneşte kurutuldu, katkısız. Kabuğuyla saklanır, taze kırılır. Her paket hasat tarihli.",
    price: 680,
    origin: "Sabırlar / Geyve / Sakarya — 775m, Kabia Çiftliği",
    method: "Organik sertifikalı, Kore Doğal Tarım & JADAM — sentetik kimyasal yok, orman kompostu, doğal killi koruma",
    image: "/images/almonds-drying.jpg",
    images: ["/images/almonds-drying.jpg", "/images/orchard-hillside.jpg", "/images/almonds-net.jpg"],
    variants: [
      { label: "500g", price: 360, stock: 120 },
      { label: "1kg", price: 680, stock: 80 },
      { label: "2kg", price: 1290, stock: 40 },
    ],
    nutrition: { calories: "620 kcal", protein: "21g", carbohydrates: "9g", fat: "55g", fiber: "11g", sodium: "1mg" },
    featured: true,
  },
  {
    slug: "ceviz-ici",
    name: "Ceviz İçi",
    cat: "ceviz",
    short: "Dost üretici — Gediz, elle kırma, gölgede kurutma",
    desc: "Manisa Gediz Havzası'nda 20 yaşında ceviz bahçesinden. Düzenli toprak analizi, elle hasat ve gölgede kurutma. Kabuksuz, el ayıklaması, doğal.",
    price: 590,
    origin: "Gediz / Manisa — Ege Ceviz Bahçesi",
    method: "Doğal — toprak analizi, elle hasat, gölgede kurutma, küçük ölçek",
    image: "/images/valley-ridge.jpg",
    images: ["/images/valley-ridge.jpg", "/images/almonds-drying.jpg"],
    variants: [
      { label: "500g", price: 310, stock: 60 },
      { label: "1kg", price: 590, stock: 40 },
    ],
    nutrition: { calories: "680 kcal", protein: "15g", carbohydrates: "13g", fat: "65g", fiber: "7g", sodium: "2mg" },
    featured: false,
  },
  {
    slug: "findik-ici",
    name: "Fındık İçi",
    cat: "findik",
    short: "Dost üretici — Ordu, 3. nesil, elde toplama",
    desc: "Ordu yamaçlarında 3. nesil aile bahçesinden fındık. Elle toplama, güneşte kurutma. Kimyasal girdiden uzak, aile ölçeği.",
    price: 520,
    origin: "Ordu / Karadeniz — Karadeniz Aile Bahçesi",
    method: "Doğal — elle hasat, güneşte kurutma, aile ölçeği",
    image: "/images/almonds-drying.jpg",
    images: ["/images/almonds-drying.jpg", "/images/field-tractor.jpg"],
    variants: [
      { label: "500g", price: 280, stock: 70 },
      { label: "1kg", price: 520, stock: 50 },
    ],
    nutrition: { calories: "640 kcal", protein: "14g", carbohydrates: "16g", fat: "61g", fiber: "10g", sodium: "1mg" },
    featured: false,
  },
  {
    slug: "cicek-bali",
    name: "Çiçek Balı",
    cat: "bal",
    short: "Dost üretici — Sivas yaylası, sabit kovan, analizli",
    desc: "Sivas yaylasında sabit kovan, gezgin değil. Aynı flora, aynı rakım. Bal olgunlaşmadan alınmaz, tahlilleri paylaşılır. Ham, süzme çiçek balı.",
    price: 420,
    origin: "Sivas / İç Anadolu — Anadolu Arıcısı",
    method: "Doğal — sabit kovan, olgun hasat, laboratuvar analizli",
    image: "/images/field-tractor.jpg",
    images: ["/images/field-tractor.jpg", "/images/orchard-hillside.jpg"],
    variants: [
      { label: "460g", price: 420, stock: 50 },
      { label: "850g", price: 720, stock: 30 },
    ],
    nutrition: { calories: "310 kcal", protein: "0g", carbohydrates: "82g", fat: "0g", fiber: "0g", sodium: "4mg" },
    featured: true,
  },
  {
    slug: "domates-salcasi",
    name: "Domates Salçası",
    cat: "salca",
    short: "Dost üretici — mevsiminde domates, geleneksel",
    desc: "Mevsiminde toplanan domateslerden, geleneksel yöntemle kaynatılan salça. Katkısız, tuz ve domatesten başka bir şey yok. Cam kavanoz.",
    price: 180,
    origin: "Geyve / Sakarya — Dost Mutfak",
    method: "Doğal — mevsiminde hasat, odun ateşinde kaynatma, katkısız",
    image: "/images/almonds-net.jpg",
    images: ["/images/almonds-net.jpg"],
    variants: [
      { label: "600g", price: 180, stock: 80 },
      { label: "1kg", price: 290, stock: 50 },
    ],
    nutrition: { calories: "90 kcal", protein: "3g", carbohydrates: "18g", fat: "0g", fiber: "3g", sodium: "800mg" },
    featured: false,
  },
  {
    slug: "elma-sirkesi",
    name: "Elma Sirkesi",
    cat: "sirke",
    short: "Dost üretici — doğal fermantasyon, katkısız",
    desc: "Doğal fermantasyonla olgunlaştırılan elma sirkesi. Pastörize değil, filtre edilmedi. Ana kültürlü, katkısız.",
    price: 150,
    origin: "Geyve / Sakarya — Dost Mutfak",
    method: "Doğal — elma, içme suyu, doğal fermantasyon",
    image: "/images/orchard-winter.jpg",
    images: ["/images/orchard-winter.jpg"],
    variants: [
      { label: "500ml", price: 150, stock: 60 },
      { label: "1L", price: 260, stock: 40 },
    ],
    nutrition: { calories: "20 kcal", protein: "0g", carbohydrates: "1g", fat: "0g", fiber: "0g", sodium: "5mg" },
    featured: false,
  },
  {
    slug: "eriste",
    name: "Erişte",
    cat: "eriste",
    short: "Dost üretici — elde kesme, güneşte kurutma",
    desc: "Köy mutfağından elde kesme erişte. Yumurta, un ve tuzla, güneşte kurutuldu. Katkısız, el emeği.",
    price: 140,
    origin: "Geyve / Sakarya — Dost Mutfak",
    method: "Doğal — elde kesme, güneşte kurutma",
    image: "/images/almonds-drying.jpg",
    images: ["/images/almonds-drying.jpg"],
    variants: [
      { label: "500g", price: 140, stock: 90 },
      { label: "1kg", price: 260, stock: 60 },
    ],
    nutrition: { calories: "360 kcal", protein: "12g", carbohydrates: "72g", fat: "2g", fiber: "3g", sodium: "10mg" },
    featured: false,
  },
  {
    slug: "tarhana",
    name: "Tarhana",
    cat: "tarhana",
    short: "Dost üretici — geleneksel, güneşte kurutma",
    desc: "Geleneksel tarhana — yoğurt, domates, biber ve unun fermantasyonu ve güneşte kurutulmasıyla. Katkısız, köy usulü.",
    price: 160,
    origin: "Geyve / Sakarya — Dost Mutfak",
    method: "Doğal — fermantasyon, güneşte kurutma",
    image: "/images/field-tractor.jpg",
    images: ["/images/field-tractor.jpg"],
    variants: [
      { label: "500g", price: 160, stock: 70 },
      { label: "1kg", price: 295, stock: 50 },
    ],
    nutrition: { calories: "340 kcal", protein: "10g", carbohydrates: "68g", fat: "2g", fiber: "5g", sodium: "600mg" },
    featured: false,
  },
];

for (const p of products) {
  const catIdVal = await getCatId(p.cat);
  const { data: existing } = await supa.from("products").select("id").eq("slug", p.slug).maybeSingle();
  if (existing) {
    console.log(`prod ${p.slug}: exists, skipping`);
    continue;
  }
  const { data: prod, error } = await supa
    .from("products")
    .insert({
      slug: p.slug,
      name: p.name,
      category_id: catIdVal,
      description: p.desc,
      short_description: p.short,
      base_price: p.price,
      main_image_url: p.image,
      origin: p.origin,
      production_method: p.method,
      shelf_life: "12 ay",
      storage_conditions: "Serin ve kuru yerde saklayın",
      certifications: p.slug === "kabuklu-badem" ? "Organik sertifikalı" : "Doğal — üreticisini tanıyoruz",
      is_active: true,
      is_featured: p.featured,
    })
    .select("id")
    .single();
  if (error) {
    console.log(`prod ${p.slug} ERR`, error.message);
    continue;
  }
  const prodId = prod.id;
  const varRows = p.variants.map((v) => ({
    product_id: prodId,
    label: v.label,
    price: v.price,
    stock_quantity: v.stock,
  }));
  const { error: vErr } = await supa.from("product_variants").insert(varRows);
  console.log(`prod ${p.slug} variants:`, vErr ? vErr.message : "ok");

  const imgRows = p.images.map((img, i) => ({
    product_id: prodId,
    image_url: img,
    sort_order: i,
  }));
  const { error: iErr } = await supa.from("product_images").insert(imgRows);
  console.log(`prod ${p.slug} images:`, iErr ? iErr.message : "ok");

  const { error: nErr } = await supa.from("nutrition_facts").insert({
    product_id: prodId,
    calories: p.nutrition.calories,
    protein: p.nutrition.protein,
    carbohydrates: p.nutrition.carbohydrates,
    fat: p.nutrition.fat,
    fiber: p.nutrition.fiber,
    sodium: p.nutrition.sodium,
  });
  console.log(`prod ${p.slug} nutrition:`, nErr ? nErr.message : "ok");
}

console.log("done");
