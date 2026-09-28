import { expect, test } from "@playwright/test";

const states = [
  ["2019", null, "Burada badem olmaz dediler. Biz toprağa kulak verdik.", "resim22.jpg"],
  ["2021", null, "946 çukur, 946 söz.", "marina-ilk-dikim.jpeg"],
  ["2022", null, "Bir kış sonra, yamaç yeşile durdu.", "marinada-2022.jpeg"],
  ["2023", null, "İki yaz sonra, dal sürgün verdi.", "marinada-2023.jpeg"],
  ["2024", null, "Kar altında, sabır çalışır.", "marinada-2024.jpeg"],
  ["2025", "Erken bahar", "Hava sıcaktı, bahçe sabredemedi.", "marinada-2025-ilkcicek.jpeg"],
  ["2025", "Don", "Dört gün, dört gece — tam çiçekte yakalandık.", "marinada-2025-don.jpeg"],
] as const;

test("sticky farm text stays put while the figures scroll past in order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const response = await page.goto("/ciftlik");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);

  const stage = page.locator("[data-farm-timeline-stage]");
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute("data-mode", "synced");
  await expect(page.locator("[data-farm-timeline-panel]")).toHaveCount(states.length);
  await expect(page.locator("[data-farm-timeline-figure]")).toHaveCount(states.length);
  await expect(page.locator("[data-farm-timeline-image]")).toHaveCount(states.length);
  // No control surface survives: the years advance by scrolling, not clicking.
  await expect(stage.getByRole("button")).toHaveCount(0);

  const sticky = page.locator("[data-farm-timeline-sticky]");
  await expect(sticky).toBeVisible();

  // Soft fade-through on the text: half-second ease, not a hard cut.
  const swapDuration = await page
    .locator('[data-farm-timeline-panel][aria-hidden="false"]')
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(swapDuration).toContain("0.5s");

  const box = (selector: string) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, selector);

  const stageInfo = await stage.evaluate((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });

  const seen: string[] = [];
  const stickyBoxes: { x: number; y: number; width: number; height: number }[] = [];
  const firstFigureYs: number[] = [];

  // Walk the whole column from just above it to just below it. The sticky
  // block should hold its viewport position while the figures move past.
  const steps = 60;
  const start = stageInfo.top - 200;
  const distance = stageInfo.height - 900 + 400;
  for (let step = 0; step <= steps; step++) {
    await page.evaluate(([y]) => window.scrollTo(0, y), [start + (distance * step) / steps] as const);
    await page.waitForTimeout(100);
    const active = page.locator('[data-farm-timeline-panel][aria-hidden="false"]');
    if ((await active.count()) === 1) {
      const title = (await active.locator("h3").textContent())?.trim() ?? "";
      if (title && seen[seen.length - 1] !== title) seen.push(title);
    }
    const stickyBox = await box("[data-farm-timeline-sticky]");
    if (stickyBox) stickyBoxes.push(stickyBox);
    const figureBox = await page.evaluate(() => {
      const figure = document.querySelector('[data-farm-timeline-figure][data-index="0"]');
      return figure ? figure.getBoundingClientRect().y : null;
    });
    if (figureBox !== null) firstFigureYs.push(figureBox);
  }

  expect(seen, "every state is reached, in order, exactly once").toEqual(states.map((s) => s[2]));

  // The sticky block holds its place: x never moves, and y/width/height are
  // constant across every sample where it is stuck to the top offset. The
  // band is tight on purpose — samples from the section tail, where the
  // block legitimately unsticks as its parent ends, must not count.
  const stuck = stickyBoxes.filter((b) => Math.abs(b.y - 128) < 2);
  expect(stuck.length, "sticky block engages for most of the column").toBeGreaterThan(steps / 2);
  const baseline = stuck[0];
  for (const measured of stuck) {
    expect(measured.x, "sticky x").toBeCloseTo(baseline.x, 0);
    expect(measured.y, "sticky y").toBeCloseTo(baseline.y, 0);
    expect(measured.width, "sticky width").toBeCloseTo(baseline.width, 0);
    expect(measured.height, "sticky height never jumps between years").toBeCloseTo(baseline.height, 0);
  }

  // The figures really scroll: the first one travels well past the viewport
  // while the sticky block stays where it is.
  expect(firstFigureYs.length).toBeGreaterThan(0);
  expect(firstFigureYs[0] - firstFigureYs[firstFigureYs.length - 1], "first figure scrolls past").toBeGreaterThan(500);

  await expect(page.getByText("2026", { exact: true })).toHaveCount(0);
  // The soil criteria live on /ciftlik itself now — no standalone /toprak
  // to link out to, so the approach section carries no link.
  await expect(page.locator("[data-farm-approach]").getByRole("link")).toHaveCount(0);
  await expect(page.locator("#farm-soil-heading")).toHaveText("Her şey toprağın altında başlar.");
});

test("every state and image is in the DOM up front, in order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ciftlik");
  const panels = page.locator("[data-farm-timeline-panel]");
  const figures = page.locator("[data-farm-timeline-figure]");
  await expect(panels).toHaveCount(states.length);
  await expect(figures).toHaveCount(states.length);
  for (const [index, [year, , title, image]] of states.entries()) {
    await expect(panels.nth(index).locator("h3")).toHaveText(title);
    await expect(panels.nth(index).locator("[data-farm-timeline-year]")).toHaveText(year);
    await expect(figures.nth(index).locator("img")).toHaveAttribute("src", new RegExp(encodeURIComponent(image)));
  }
});

test("reduced motion and narrow screens get the full chronology, stacked and unfaded", async ({ page }) => {
  for (const [width, reducedMotion] of [[1280, "reduce"], [390, "no-preference"]] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ciftlik");
    await page.evaluate(() => document.fonts.ready);

    const stage = page.locator("[data-farm-timeline-stage]");
    await expect(stage).toHaveAttribute("data-mode", "quiet");
    const panels = page.locator("[data-farm-timeline-panel]");
    const figures = page.locator("[data-farm-timeline-figure]");
    await expect(panels).toHaveCount(states.length);
    await expect(figures).toHaveCount(states.length);
    // Nothing hidden, nothing faded, nothing sticky-swapped — all seven are readable.
    await expect(page.locator('[data-farm-timeline-panel][aria-hidden="true"]')).toHaveCount(0);
    await expect(page.locator("[data-farm-timeline-sticky]")).toHaveCount(0);
    for (const [index, [, , title]] of states.entries()) {
      await expect(panels.nth(index).locator("h3")).toHaveText(title);
      const opacity = await panels.nth(index).evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(opacity), `${title} opacity at ${width}px`).toBe(1);
    }
    await expect(stage.getByRole("button")).toHaveCount(0);

    if (width < 768) {
      // Mobile is a plain stacked sequence: each year text above its image.
      for (const [index, [, , title]] of states.entries()) {
        const positions = await page.evaluate((i) => {
          const panel = document.querySelector(`[data-farm-timeline-panel][data-index="${i}"]`);
          const figure = document.querySelector(`[data-farm-timeline-figure][data-index="${i}"]`);
          if (!panel || !figure) return null;
          const panelRect = panel.getBoundingClientRect();
          const figureRect = figure.getBoundingClientRect();
          const panelTop = panelRect.top + window.scrollY;
          const figureTop = figureRect.top + window.scrollY;
          return { panelTop, figureTop, panelBottom: panelTop + panelRect.height };
        }, index);
        expect(positions, `${title} positions`).not.toBeNull();
        expect(positions!.panelTop, `${title} text above its image`).toBeLessThan(positions!.figureTop);
      }
    }
  }
});

test("without JavaScript the full chronology still reads as a coherent sequence", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  const response = await page.goto("/ciftlik");
  expect(response?.status()).toBe(200);

  const stage = page.locator("[data-farm-timeline-stage]");
  await expect(stage).toHaveAttribute("data-mode", "quiet");
  await expect(page.locator("[data-farm-timeline-panel]")).toHaveCount(states.length);
  await expect(page.locator("[data-farm-timeline-figure]")).toHaveCount(states.length);
  for (const [index, [, , title, image]] of states.entries()) {
    await expect(page.locator("[data-farm-timeline-panel]").nth(index).locator("h3")).toHaveText(title);
    await expect(page.locator("[data-farm-timeline-figure]").nth(index).locator("img")).toHaveAttribute(
      "src",
      new RegExp(encodeURIComponent(image)),
    );
  }
  // Coherent rather than a lone 2019 next to seven images: every text is
  // present and none is hidden from assistive tech.
  await expect(page.locator('[data-farm-timeline-panel][aria-hidden="true"]')).toHaveCount(0);
  await expect(page.locator("[data-farm-timeline-sticky]")).toHaveCount(0);
  await context.close();
});

test.beforeEach(async ({ request }) => { await request.get("http://localhost:3441/__test/reset"); });

const previewEnabled = process.env.KABIA_BRAND_PREVIEW === "1";
test('preview detail reaches only a persistent guest cart and cannot enter payment', async ({page, request}) => {
  const response = await page.goto('/shop/onizleme-kabia-ciftligi');
  if (!previewEnabled) { expect(response?.status()).toBe(404); return; }
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', {name:'Örnek Badem',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Favorilere ekle',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Değerlendirme yaz',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Sepete ekle',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kabia_cart')??'[]').length)).toBe(1);
  expect(await page.evaluate(()=>localStorage.getItem('kabia_recently_viewed'))).toBeNull();
  await page.goto('/sepet');
  await expect(page.getByRole('button',{name:'Ödemeye geç',exact:true})).toBeDisabled();
  await expect(page.getByText('Sepetinizde önizleme ürünü var.',{exact:false})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Örnek Badem',{exact:true})).toBeVisible();
  await page.goto('/odeme');
  await expect(page).toHaveURL(/\/sepet$/);
  await expect(page.getByRole('textbox',{name:/Kart numarası/})).toHaveCount(0);
  const api = (await request.get('http://localhost:3441/__test/requests'));
  const calls=await api.json() as {method:string,path:string}[];
  expect(calls.filter(c=>['POST','PATCH','DELETE'].includes(c.method) && c.path!=='/rest/v1/rpc/get_published_site_theme')).toEqual([]);
});

const previewCartItem = {
  id: "onizleme-kabia-ciftligi__500 g", slug: "onizleme-kabia-ciftligi", name: "Örnek Badem", variant: "500 g", price: 100, quantity: 1,
  image: "/images/kabia-badem.jpeg", variantId: "kabia-preview:kabia-ciftligi:500g", productId: "kabia-preview:kabia-ciftligi",
};
const normalCartItem = { ...previewCartItem, id: "normal__500g", slug: "test-normal-badem", name: "Normal katalog bademi", productId: "11111111-1111-4111-8111-111111111111", variantId: "22222222-2222-4222-8222-222222222222" };

test("restored mixed carts stay blocked in either flag state; quantity and removal persist", async ({ page, request }) => {
  await page.goto("/ciftlik");
  await page.evaluate((items) => localStorage.setItem("kabia_cart", JSON.stringify(items)), [normalCartItem, previewCartItem]);
  await page.goto("/sepet");
  await expect(page.getByText("Sepetinizde önizleme ürünü var.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Örnek Badem adedini artır" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kabia_cart")!)[1].quantity)).toBe(2);
  await page.reload();
  await expect(page.getByRole("button", { name: "Ödemeye geç", exact: true })).toBeDisabled();
  await page.goto("/odeme");
  await expect(page).toHaveURL(/\/sepet$/);
  await page.getByRole("button", { name: "Kaldır — Örnek Badem" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kabia_cart")!).map((item: {slug: string}) => item.slug))).toEqual([normalCartItem.slug]);
  await expect(page.getByText("Sepetinizde önizleme ürünü var.", { exact: false })).toHaveCount(0);
  const calls = await (await request.get("http://localhost:3441/__test/requests")).json();
  expect(calls.filter((call: {method:string;path:string}) => call.method !== "GET" && call.path !== "/rest/v1/rpc/get_published_site_theme")).toEqual([]);
});

test("actual auth subscription excludes preview-only cart and favorites from login migration", async ({ page, request }) => {
  await page.goto("/ciftlik");
  await page.evaluate((item) => {
    localStorage.setItem("kabia_cart", JSON.stringify([item]));
    localStorage.setItem("kabia_favorites", JSON.stringify([item.slug]));
  }, previewCartItem);
  await page.goto(previewEnabled ? "/shop/onizleme-kabia-ciftligi" : "/sepet");
  await expect(page.getByText("Örnek Badem", { exact: true }).first()).toBeVisible();
  await page.evaluate(() => {
    // Supabase's existing cross-tab auth channel, consumed by the real AuthProvider.
    const channel = new BroadcastChannel("sb-localhost-auth-token");
    channel.postMessage({ event: "SIGNED_IN", session: { user: { id: "33333333-3333-4333-8333-333333333333", email: "test@example.invalid", created_at: "2026-01-01T00:00:00Z" } } });
    channel.close();
  });
  await expect.poll(async () => {
    const calls = await (await request.get("http://localhost:3441/__test/requests")).json();
    return calls.some((call: {path:string}) => call.path === "/rest/v1/carts");
  }).toBe(true);
  if (previewEnabled) {
    await expect(page.getByRole("button", { name: "Sepete ekle", exact: true })).toBeDisabled();
    await expect(page.getByText("Önizleme ürünleri yalnızca misafir sepetinde denenebilir.")).toBeVisible();
  } else {
    await expect(page.getByText("Örnek Badem", { exact: true })).toHaveCount(0);
  }
  const calls = await (await request.get("http://localhost:3441/__test/requests")).json();
  expect(calls.filter((call: {method:string;path:string}) => call.method !== "GET" && call.path !== "/rest/v1/rpc/get_published_site_theme")).toEqual([]);
  expect(calls.filter((call: {path:string;query:string}) => call.query?.includes("onizleme") || call.query?.includes("kabia-preview"))).toEqual([]);
});

test("store gate selects before catalog reads and preserves off-state successful, empty and error results", async ({ page, request }) => {
  for (const mode of ["success", "empty", "error"]) {
    await request.get(`http://localhost:3441/__test/reset?catalog=${mode}`);
    await page.goto("/magaza");
    await expect(page.locator("[data-store-listing]")).toBeVisible();
    if (previewEnabled) {
      await expect(page.getByRole("heading", { name: "Örnek Badem", exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("Örnek Badem", { exact: true })).toHaveCount(0);
      await expect(page.getByText(mode === "success" ? "Normal katalog bademi" : mode === "empty" ? "Mağaza şu an boş." : "Ürünler şu anda yüklenemiyor.", { exact: true })).toBeVisible();
    }
    const calls = await (await request.get("http://localhost:3441/__test/requests")).json();
    const catalogReads = calls.filter((call: {path:string}) => ["/rest/v1/products", "/rest/v1/producers"].includes(call.path));
    expect(catalogReads.length === 0).toBe(previewEnabled);
  }
  for (const path of ["/shop/onizleme-unknown", "/magaza/unknown-producer"]) expect((await page.goto(path))?.status()).toBe(404);
});

test("preview producer stores validate source slugs and avoid catalog reads including story metadata", async ({ page, request }) => {
  const slugs = ["kabia-ciftligi", "geyve-setce-findik", "ege-ceviz", "anadolu-bal", "akinci-ihlamur", "domates-salcasi", "elma-sirkesi", "alic-sirkesi", "eriste", "tarhana"];
  for (const slug of slugs) {
    const response = await page.goto(`/magaza/${slug}`);
    expect(response?.status()).toBe(previewEnabled ? 200 : 404);
    if (previewEnabled) {
      await expect(page.locator('[data-store-listing] h2')).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('[data-store-listing] a[href^="/shop/onizleme-"]').first()).toHaveAttribute('href', `/shop/onizleme-${slug}`);
    }
  }
  if (previewEnabled) {
    await page.goto('/ureticiler/geyve-setce-findik');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const calls = await (await request.get('http://localhost:3441/__test/requests')).json();
    expect(calls.filter((call: {path:string}) => ['/rest/v1/products', '/rest/v1/producers'].includes(call.path))).toEqual([]);
  }
});

test("the restored grid, source row and two controls drive one shared listing", async ({ page }) => {
  test.skip(!previewEnabled, "local example catalog only; off-state result/layout covered separately");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/magaza");
  const store = page.locator("[data-store-listing]");

  // main's grid: three columns of ProductEntry, each an <li> with an h2.
  const grid = store.locator("ul.grid");
  await expect(grid.locator("> li")).toHaveCount(10);
  await expect(store.locator("h2")).toHaveCount(10);
  const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(3);
  await expect(store.getByText("Stokta yok").first()).toBeVisible();

  // Sade rozet: görselde en fazla "Stokta yok" yazar, kaynak metin satırındadır.
  const imageTexts = await store.evaluate(() =>
    [...document.querySelectorAll("[data-store-listing] ul.grid > li")].map(
      (li) => li.querySelector("div.relative")?.textContent ?? "",
    ),
  );
  expect(imageTexts.length).toBe(10);
  for (const text of imageTexts) expect(text).not.toMatch(/Kabia/);
  await expect(grid.locator("> li").first().locator("p.label").first()).toContainText("•");

  // Option A: sources stay as the row; category and sort are controls right.
  const sort = store.getByLabel("Sırala");
  const category = store.getByLabel("Kategori");
  await expect(sort).toHaveCount(1);
  await expect(category).toHaveCount(1);
  await expect(store.getByRole("link", { name: "Fiyat: azalan", exact: true })).toHaveCount(0);
  await expect(store.getByRole("link", { name: "Çiğ Badem", exact: true })).toHaveCount(0);
  await sort.selectOption("fiyat-azalan");
  await expect(page).toHaveURL(/sirala=fiyat-azalan/);
  await expect(store.locator("h2").first()).toHaveText("Örnek Tarhana");

  // The source row narrows the category control to what that source has.
  await store.getByRole("link", { name: "Çiftlik", exact: true }).click();
  await expect(page).toHaveURL(/kaynak=ciftlik/);
  await expect(category.locator("option")).toHaveText(["Tümü", "Çiğ Badem"]);
  await category.selectOption("cig-badem");
  await expect(page).toHaveURL(/kategori=cig-badem&kaynak=ciftlik/);
  await expect(store.locator("h2")).toHaveCount(1);

  // The same grid collapses to one column on a phone; no sidebar survives.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(store.locator("aside")).toHaveCount(0);
  const narrow = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(narrow).toBe(1);
});

test("shop, magaza and a producer store render the same listing structure", async ({ page }) => {
  test.skip(!previewEnabled, "producer stores exist only behind the gate");
  await page.setViewportSize({ width: 1280, height: 900 });

  const shape = async (path: string) => {
    await page.goto(path);
    return page.evaluate(() => {
      const store = document.querySelector("[data-store-listing]")!;
      const grid = store.querySelector("ul.grid");
      const entry = grid?.querySelector("li");
      return {
        navs: [...store.querySelectorAll("nav")].map((n) => n.getAttribute("aria-label")),
        selects: [...store.querySelectorAll("select")].map((s) => s.labels?.[0]?.textContent ?? null),
        gridClass: grid?.className ?? null,
        columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
        entryClass: entry?.className ?? null,
        imageClass: entry?.querySelector("div")?.className ?? null,
      };
    });
  };

  const shop = await shape("/shop");
  const magaza = await shape("/magaza");
  const producer = await shape("/magaza/tarhana");

  expect(magaza).toEqual(shop);
  expect(shop.navs).toEqual(["Kaynaklar"]);
  expect(shop.selects).toEqual(["Kategori", "Sırala"]);
  // The producer store is the same listing, only its catalogue is narrower.
  expect(producer.gridClass).toBe(shop.gridClass);
  expect(producer.entryClass).toBe(shop.entryClass);
  expect(producer.imageClass).toBe(shop.imageClass);
  expect(producer.columns).toBe(shop.columns);
  expect(producer.selects).toEqual(shop.selects);
});


test("homepage introduces three sources with three product links and no commerce", async ({ page }) => {
  await page.goto("/");
  const intro = page.locator("#urunler");
  await expect(intro).toBeVisible();

  // The three lines are one heading split by <br>, so assert on its text.
  const statement = (await intro.getByRole("heading", { level: 2 }).first().textContent()) ?? "";
  for (const line of ["Bizim toprağımızdan.", "Tanıdığımız üreticilerden.", "Üreticilerin mutfağından."]) {
    expect(statement).toContain(line);
  }

  const links = intro.locator('a[href^="/shop/"]');
  await expect(links).toHaveCount(3);
  const hrefs = await links.evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  expect(hrefs).toEqual(previewEnabled
    ? ["/shop/onizleme-kabia-ciftligi", "/shop/onizleme-geyve-setce-findik", "/shop/onizleme-domates-salcasi"]
    : ["/shop/kabuklu-badem", "/shop/findik-ici", "/shop/tarhana"]);

  for (const name of ["Kabia Çiftliği", "Kabia Seçki", "Kabia Mutfak"]) {
    await expect(intro.getByText(name, { exact: true })).toBeVisible();
  }

  const text = (await intro.textContent()) ?? "";
  expect(text).not.toMatch(/₺\d/);
  expect(text).not.toMatch(/Sepete/);
  await expect(intro.getByRole("button")).toHaveCount(0);
});

test("secki grid shows the four producers at every breakpoint with distinct destinations", async ({ page }) => {
  const slugs = ["geyve-setce-findik", "ege-ceviz", "anadolu-bal", "akinci-ihlamur"];
  const response = await page.goto("/secki");
  expect(response?.status()).toBe(200);

  const cards = page.locator("#secki-heading ~ * li, section li").filter({ has: page.getByRole("link", { name: /Hikâyeyi Gör/ }) });
  await expect(cards).toHaveCount(4);

  for (const slug of slugs) {
    await expect(page.locator(`a[href="/ureticiler/${slug}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href="/magaza/${slug}"]`)).toHaveCount(1);
  }

  // No farm or kitchen record leaked in through an exclusion filter.
  for (const absent of ["kabia-ciftligi", "alic-sirkesi", "tarhana"]) {
    await expect(page.locator(`a[href="/magaza/${absent}"]`)).toHaveCount(0);
  }

  // Accessible names stay distinct per producer, so the two buttons on each
  // card are not four identically-named links.
  await expect(page.getByRole("link", { name: /^Hikâyeyi Gör — / })).toHaveCount(4);
  await expect(page.getByRole("link", { name: /^Mağazada Gör — / })).toHaveCount(4);

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(cards.first()).toBeVisible();
    const columns = await page.locator("#secki-heading").evaluate(() => {
      const list = document.querySelector("section ul");
      return list ? getComputedStyle(list).gridTemplateColumns.split(" ").length : 0;
    });
    expect(columns).toBe(width >= 1024 ? 3 : width >= 640 ? 2 : 1);
  }
});

test("header offers Çiftlik and Seçki and keeps Üreticiler and Günlük in the footer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const header = page.getByRole("navigation", { name: "Ana menü" });
  // Exactly one link per label: the farm section anchor was removed so that
  // "Çiftlik" is not ambiguous between /ciftlik and #ciftlik.
  await expect(header.getByRole("link", { name: "Çiftlik", exact: true })).toHaveCount(1);
  await expect(header.getByRole("link", { name: "Çiftlik", exact: true })).toHaveAttribute("href", "/ciftlik");
  await expect(header.getByRole("link", { name: "Seçki", exact: true })).toHaveCount(1);
  await expect(header.getByRole("link", { name: "Seçki", exact: true })).toHaveAttribute("href", "/secki");
  await expect(header.getByRole("link", { name: "Üreticiler", exact: true })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Günlük", exact: true })).toHaveCount(0);

  const footer = page.locator("footer");
  for (const [label, href] of [["Seçki", "/secki"], ["Üreticiler", "/ureticiler"], ["Günlük", "/gunluk"]] as const) {
    await expect(footer.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
  }
});

test("admin blog surfaces are gone while every other admin route keeps its response", async ({ page }) => {
  // Unauthenticated only. The proxy redirects every /admin/* path to the login
  // before routing — a path that never existed answers 307 just as a removed
  // one does — so this cannot by itself prove removal. It proves the removal
  // introduced no special handling and left the surviving routes untouched;
  // that the routes are really gone is asserted from the source in
  // tests/admin-nav.test.ts and from the build's route manifest.
  const neverExisted = await page.request.get("/admin/definitely-not-a-route", { maxRedirects: 0 });
  for (const removed of ["/admin/blog", "/admin/blog/new", "/admin/blog/categories"]) {
    const response = await page.request.get(removed, { maxRedirects: 0 });
    expect(response.status(), `${removed} should behave like a nonexistent admin path`)
      .toBe(neverExisted.status());
  }

  const surviving = [
    ["/admin/login", 200], ["/admin/unauthorized", 200],
    ["/admin/products", 307], ["/admin/orders", 307], ["/admin/customers", 307],
    ["/admin/inventory", 307], ["/admin/categories", 307], ["/admin/content", 307],
    ["/admin/media", 307], ["/admin/settings", 307], ["/admin/appearance", 307],
    ["/admin/audit-logs", 307], ["/admin/administrators", 307], ["/admin/search", 307],
  ] as const;
  for (const [route, expected] of surviving) {
    const response = await page.request.get(route, { maxRedirects: 0 });
    expect(response.status(), `${route} changed response`).toBe(expected);
  }
});

test("public blog and standalone soil page are gone while the journal and producer pages survive", async ({ page }) => {
  for (const removed of ["/blog", "/blog/herhangi-bir-yazi", "/blog/rss.xml", "/toprak"]) {
    const response = await page.request.get(removed, { maxRedirects: 0 });
    expect(response.status(), `${removed} should be gone`).toBe(404);
  }

  await page.goto("/");
  await expect(page.locator('a[href^="/blog"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Blog", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/toprak"]')).toHaveCount(0);

  for (const kept of ["/gunluk", "/ciftlik", "/secki", "/ureticiler", "/magaza"]) {
    const response = await page.request.get(kept, { maxRedirects: 0 });
    expect(response.status(), `${kept} must survive`).toBe(200);
  }

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/blog");
  expect(sitemap).not.toContain("onizleme-");
  expect(sitemap).toContain("/secki");
});
