import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// §8.1: the database is the single source of truth. Live row assertions need
// the database; the migration content and read-path wiring pin here.

describe("producer_convergence migration", () => {
  const src = readFileSync("supabase/migrations/20260926001700_producer_convergence.sql", "utf8");

  it("writes the curated copy where it differed", () => {
    assert.match(src, /name = 'Geyve — Setçe Köyü Aile Bahçesi', photo_url = '\/images\/findik2\.jpeg'/);
    assert.match(src, /tagline = 'Mevsiminde olgunlaşan domatesler, kazanda ağır ağır koyulaşır\.'/);
  });

  it("preserves the homepage strip order in sort_order", () => {
    for (const [slug, order] of [
      ["kabia-ciftligi", 0],
      ["geyce-setce-findik", 10],
      ["ege-ceviz", 20],
      ["anadolu-bal", 30],
      ["akinci-ihlamur", 40],
      ["domates-salcasi", 50],
      ["elma-sirkesi", 60],
      ["alic-sirkesi", 70],
      ["eriste", 80],
      ["tarhana", 90],
    ] as const) {
      assert.match(src, new RegExp(`sort_order =\\s+${order}\\s+where slug = '${slug}'`));
    }
  });
});

describe("producer read paths", () => {
  it("/secki reads the database with an honest outage state", () => {
    const src = readFileSync("app/secki/page.tsx", "utf8");
    assert.match(src, /fetchSeckiProducers/);
    assert.match(src, /Üretici profilleri şu anda yüklenemiyor\./);
    assert.ok(!src.includes("const producers = producerCollections.secki"));
  });

  it("/mutfak reads the database with an honest outage state", () => {
    const src = readFileSync("app/mutfak/page.tsx", "utf8");
    assert.match(src, /fetchProducersBySource\(await createSupabaseServerClient\(\), "mutfak"\)/);
    assert.match(src, /Üretici profilleri şu anda yüklenemiyor\./);
  });

  it("homepage strip reads the database", () => {
    const src = readFileSync("components/home/producers.tsx", "utf8");
    assert.match(src, /fetchSeckiProducers/);
    assert.ok(!src.includes("const producers = producerCollections.secki"));
  });

  it("/ureticiler carries no hardcoded order", () => {
    const src = readFileSync("app/ureticiler/page.tsx", "utf8");
    assert.ok(!src.includes("const ORDER"), "hardcoded ORDER removed");
    assert.ok(!src.includes("inCuratedOrder"), "curated sorter removed");
    assert.match(src, /fetchPublicProducers/);
  });

  it("cards render the administered tagline", () => {
    const src = readFileSync("components/producers/producer-card.tsx", "utf8");
    assert.match(src, /producer\.tagline \?\? producer\.desc/);
  });

  it("producer pages split story paragraphs and surface tagline in meta", () => {
    const src = readFileSync("app/ureticiler/[slug]/page.tsx", "utf8");
    assert.match(src, /splitStoryParagraphs\(producer\.story\)/);
    assert.match(src, /\$\{producer\.story \?\? storyFallback\} \$\{tagline\}/);
  });
});
