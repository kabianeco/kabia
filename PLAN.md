# KABIA — BRAND-FIRST RESTRUCTURE
## Implementation plan

---

## 0. WHERE THE WORK HAPPENS

**Target repository:** `/Users/mustafa/kabia-2.0-revision`
**Target branch:** `feat/kabia-2.0-revision` (already checked out there)

All changes, all commits, all verification happen here. Nothing is created, modified, or committed anywhere else.

This directory is a worktree of `/Users/mustafa/kabia-latest`. Do not touch `kabia-latest`, its `main` branch, or the `kabia-perf-opt` worktree.

Two untracked files exist in the target (`supabase/config.toml`, `supabase/.gitignore`). They are known and expected. Leave them exactly as they are — do not stage, commit, delete, or read them.

### Read-only sources

| Path | What it is | Rule |
|---|---|---|
| `/Users/mustafa/kabia-2.0` | Content source: farm narrative, approach principles, year records, producer copy, images | **Read only.** Never write. Never commit. Never run git commands here. |
| `/Users/mustafa/kabia-brand` (branch `feat/brand-restructure`) | A prior implementation of this same plan against a *different* codebase | **Read only, reference only.** Useful for seeing how a piece was solved. Do not cherry-pick, merge, or copy files wholesale — its markup targets a different tree. |

Never delete either of those worktrees or their branches.

---

## 1. WHAT THIS IS

Kabia is a Turkish ecological food brand: almonds from its own 19-dönüm orchard in Sabırlar, Geyve, Sakarya, plus products from small producers it has personally vetted.

```
Toprağa saygıyla üretilenleri bir araya getiriyoruz.
Kendi çiftliğimizden ve güvendiğimiz üreticilerden.
```

Three sources: **Kabia Çiftliği** (own land), **Kabia Seçki** (trusted producers), **Kabia Mutfak** (traditional production).

**The intent behind every item below:** Kabia should read as a brand telling its own story, not a webshop burying the visitor in products. Introduce ourselves first, the product second. The site must still sell — price, stock and add-to-cart stay easy and visible on store and product pages — but the homepage and the story pages lead with land and people.

All user-facing copy is **Turkish** and stays Turkish. This document is English for the implementer only.

---

## 2. HARD RULES

### 2.1 Git

- Work only in `/Users/mustafa/kabia-2.0-revision` on `feat/kabia-2.0-revision`. Verify `pwd` and `git branch --show-current` before any file operation.
- No `push`, `merge`, `rebase`, `reset`, `squash`, `amend`, `force`, or PR.
- No `git worktree remove`. No branch deletion.
- Commit in the logical chunks listed in §9.

### 2.2 Database — hard stop

- No migrations authored or applied. No SQL. No Supabase MCP calls.
- No `supabase link` / `start` / `push` / `reset`. The `supabase/` directory is untouched.
- No writes to any database. No seeding.
- Do not change the signature or return type of any existing query function.

### 2.3 Design lock

- **Do not touch:** `tailwind.config.*`, `globals.css`, font configuration, `components/ui/*`, `next.config`, `package.json`, the lockfile.
- No new dependencies, icon sets, or fonts.
- No new CSS files. No new design tokens. No JSX inline `style={{}}`.
- Arbitrary Tailwind values only where the identical value already appears elsewhere in this codebase.
- Build from existing components and markup patterns. Before writing any new component, find the nearest existing equivalent and clone its structure and classes.
- Images: local assets under `public/` only. No remote image domain.

**Latitude:** where an existing pattern genuinely doesn't fit, or a clearly better arrangement exists *within the established visual language*, you may deviate — but report it with reasoning. Latitude means better composition using the existing vocabulary. It never means new colors, type scales, spacing systems, or libraries.

### 2.4 Shared stylesheet — additive only

If this codebase has a shared stylesheet backing its story pages (the source repo calls it `documentary.css`; find this repo's equivalent):

- Append new, narrowly-scoped modifier classes only.
- The original file content must survive **byte-identical as a prefix** of the new file.
- No existing selector or value may be modified or deleted.
- Report this file's diff separately from everything else.

---

## 3. FIRST STEP — MAP THE TARGET

This plan was written against a different tree. **File paths in it are guidance, not addresses.** Before implementing, produce a mapping report:

1. What does the target's homepage render today, section by section — component names and file paths?
2. What do `/ciftlik`, `/secki`, `/ureticiler/[slug]`, `/magaza`, `/shop` (or their equivalents) render today, and where does their data come from?
3. Does the target have a shared story-page stylesheet and markup convention (the `doc-*` idiom, `PageShell`, or something else)? Which do the story pages use?
4. Where does producer data come from on the target — a local content file, a Supabase query, or a flag-gated fixture?
5. The target's tip commit `a811e0f` is marked `[TEMPORARY] preview(phase-3): flag-gated design-review fixtures`. What does that fixture system do, what flag gates it, and does it overlap or collide with the preview system §6 requires? **Reconcile into one mechanism — do not build a second parallel preview system.** Report your reconciliation before implementing it.
6. Does the target have a blog (public routes, components, lib, admin surfaces, tests)?
7. For each work item in §5, name the existing component or markup pattern you will clone.

**Report this, then stop and wait for approval before writing code.**

---

## 4. CONTENT SOURCES AND PRECEDENCE

All farm and producer copy comes from `/Users/mustafa/kabia-2.0`. Nothing is invented — no farm facts, dates, yields, certificates, analyses, or producer histories.

| Content | Source | Rule |
|---|---|---|
| Farm philosophy | `app/emanet/page.tsx` | Authoritative |
| The seven approach principles | `app/emanet/page.tsx` | Authoritative. Use the seven originals verbatim; write no new explanations |
| Year timeline (headings, narratives, photos) | `app/ciftlikten/page.tsx` | **Sole authority** |
| Producer copy and images | `content/producers.ts` | Keep existing PLACEHOLDER markers intact |
| Images | `public/images/` in the source repo | Copy the files needed into the target's `public/` |

**Single-sourcing rule for the timeline:** build it from `ciftlikten` only. Do **not** import `emanet`'s year notes for any year, do not merge them, do not footnote them. This resolves the 2021/2022/2023/2024 discrepancies by removing the reconciliation problem rather than adjudicating it. If a year reads thin, leave it thin.

Take **text, images and facts** from the source repo — never its layout, components, or styling.

---

## 5. THE WORK

### A. Homepage — remove the producer card list

The homepage's producer section currently renders a horizontal card list (six cards in the source repo: Kabia Çiftliği, Setçe fındığı, Kayadibi cevizi, Kılıçkaya balı, Akıncı ıhlamuru, Alıç Sirkesi). **Find the target's equivalent and report what it renders before deleting it.**

- Remove the card list.
- Keep the section's narrative and photo in place; add a link through to `/secki` using the existing button language.
- Do not delete the card component itself if another page still uses it.
- Remove any genuinely unused product-collection component.
- All other section order and outer spacing is preserved.

*Note from the source repo, worth checking here:* one item (Alıç Sirkesi) appeared in that list because of a gap in a kitchen-exclusion filter. Check whether the same gap exists on other producer surfaces in the target and report it.

### B. Homepage — three-source statement, three products

```
Bizim toprağımızdan.
Tanıdığımız üreticilerden.
Üreticilerin mutfağından.
```

If the homepage already has a section carrying these three lines, reuse it in place rather than adding a second one.

- **Three products only** — one per source (almond / hazelnut / tarhana or equivalent).
- **No price, no stock, no badges, no add-to-cart.** Image, source name, short product name, and a link through. Nothing else.
- Clone the section's existing linked-image cards. No new card component.

### C. `/ciftlik` — farm narrative, timeline, approach

The target already has a `/ciftlik`. This restructures it.

**a) Farm opening.** Use the homepage's centered opening-section layout. Copy from `emanet`'s farm philosophy.

**b) Year timeline.** Below it.

- Step headings are **years**.
- Layout: text and heading left, image right — the same two-column arrangement already used elsewhere on the site.
- Selecting a year swaps **both** the image and the heading/body text.
- **The layout does not move.** Panels occupy the same grid cell; the tallest content sets the height; inactive panels are invisible and non-interactive. Image area and sub-step control area stay fixed. No JS pixel-height measurement, no layout shift, no height jump.
- Transition: the existing short opacity treatment only. Honor reduced-motion.
- Keyboard accessible.

**Approved year set — 2019, 2021, 2022, 2023, 2024, 2025.** First selection is 2019. 2025 has two sub-steps, first **Erken bahar**, then **Don**. No 2026, no placeholder for it. Each record keeps its year eyebrow, main heading, both narrative paragraphs, and its matched photo.

| Year | Heading | Body source (`app/ciftlikten/page.tsx`) | Image |
|---|---|---|---|
| 2019 | 2019 KASIM — OLMAZ DENİLENİ YAPMAK<br>"Burada badem olmaz dediler. Biz toprağa kulak verdik." | ~line 29: "2019 Kasım, Sabırlar…" + "O kışı analize…" | `resim22.jpg` |
| 2021 | 2021 TEMMUZ — 946 FİDAN TOPRAKLA BULUŞTU<br>"946 çukur, 946 söz." | ~line 42: "2019'da dinlediğimiz…" + "O yaz suyu değil…" | `marina-ilk-dikim.jpeg` |
| 2022 | 2022 MAYIS — BAHÇE UYANDI<br>"Bir kış sonra, yamaç yeşile durdu." | ~line 55: "Temmuz'un çelimsiz fidanları…" + "O bahar hiçbir fidanın…" | `marinada-2022.jpeg` |
| 2023 | 2023 TEMMUZ — AĞAÇ KENDİNİ GÖSTERDİ<br>"İki yaz sonra, dal sürgün verdi." | ~line 68: "Temmuz 2023, ikinci yaz…" + "O yaz ilk kez budamayı…" | `marinada-2023.jpeg` |
| 2024 | 2024 OCAK — BAHÇE UYKUDA<br>"Kar altında, sabır çalışır." | ~line 81: "Ocak 2024, Kılıçkaya bembeyaz…" + "Dışarıdan bakan…" | `marinada-2024.jpeg` |
| 2025 · Erken bahar | 2025 MART — DOĞA ERKEN UYANDI<br>"Hava sıcaktı, bahçe sabredemedi." | ~line 94: "Mart 2025, hava normalden sıcaktı…" + "O çiçekleri görünce…" | `marinada-2025-ilkcicek.jpeg` |
| 2025 · Don | 18 MART 2025 — ÇİÇEKTEN DONA<br>"Dört gün, dört gece — tam çiçekte yakalandık." | ~line 107: "18 Mart'ta hava döndü…" + "O 4 gün boyunca…" | `marinada-2025-don.jpeg` |

Line numbers are approximate — verify against the actual file.

**c) Approach section.** Immediately after the timeline. Use the homepage's soil-section layout. Show the seven original principles from `emanet` in the existing philosophy-card idiom. No new explanatory copy.

**Homepage:** the farm opening and soil approach **stay on the homepage** as the short introduction; `/ciftlik` carries the depth and the chronology. Do not revive unused legacy origin/principles components.

### D. Remove the blog entirely

- Delete public blog routes, RSS, blog components, and `lib/blog` files left without consumers.
- Delete blog-only tests.
- Clean references from sitemap, site config, and header/footer links.
- Admin blog surfaces (routes, editor, nav entry, permission key, admin shell and status references) come out in **their own commit** (§9).
- **Preserve:** non-blog parts of shared admin components, theme/preview infrastructure, and historical blog action labels in the admin audit module — those keep old audit records readable.
- **No database or schema changes.** Tables stay.
- If something can't be removed safely (shared component, type, or query used elsewhere), report it rather than tearing it out.

After the admin commit, verify the admin area still builds and its routes still respond as they did before. If an admin route breaks and the fix isn't obvious, stop and report.

### E. `/secki` — producer grid

The target already has a `/secki`. This restructures it.

- **3 across on desktop**, 2 at intermediate widths, 1 on mobile, using the existing grid pattern.
- Each card, top to bottom: **image → one short line of copy → product type → two buttons: `Hikâyeyi Gör` and `Mağazada Gör`.**
- Remove badges and tag stacks. Keep cards quiet — one type label.
- `Hikâyeyi Gör` → the existing producer story route.
- `Mağazada Gör` → the producer's store page (§F).
- Reuse the page's own card markup and classes, restructured with a Seçki-specific modifier. No new card component. Leave other pages' horizontal card usage intact.

### F. Producer store pages and local preview products

- One store page per producer, at the target's store-route convention (`/magaza/[producer-slug]` unless the target's actual convention differs — report and recommend).
- Validate the producer slug against the producer content source; unknown slug → 404.
- **1–2 placeholder products per producer**, from a local content file with an explicit preview-only header comment. Obviously generic names. No invented certificates, analyses, ratings, or reviews. Images from existing local files.
- These are shop pages: price, weight, stock and add-to-cart behave normally here.
- Reuse the existing store listing template; extract the shared list row/ledger pattern rather than rebuilding it.
- Extend the local type with a producer reference. **Do not change any `lib/` query signature or return type.**

### G. Store — tidy filters and sorting

- Categories grouped under the three sources, drawn from existing category definitions. Only categories actually present are shown. Default **Tümü**.
- Sorting: **Varsayılan**, **Fiyat: artan**, **Fiyat: azalan**. Default preserves current list order.
- Desktop: category groups left, products center, **sort options as a vertical list on the right.**
- Mobile: categories and sorting in one compact collapsible panel. Do not push the desktop side columns onto small screens.
- Use existing form/selection markup and the existing collapsible idiom. No new query, no new filter API.

---

## 6. PREVIEW GATE AND ORDER BOUNDARY

Preview content must never leak into normal behavior, and must never be able to produce an order.

### 6.1 Explicit gate — not heuristic

Gate on an explicit environment switch, held in one small server module:

```ts
process.env.KABIA_BRAND_PREVIEW === "1"
```

- **Never** trigger the preview branch on an empty or failed catalog query. A transient database failure must not silently serve fake products.
- **Switch off:** store, product detail, and producer store pages behave byte-identically to today, including existing empty states and 404s. Preview products are not published anywhere. Homepage's three intro links point at real product slugs.
- **Switch on:** the preview branch reads local products directly. It does not wait on a database result first.
- Do not create an env file. Review server is started with the variable inline.
- If the target's existing `a811e0f` fixture flag already does this job, **reconcile into one flag** (§3.5) rather than adding a second.

### 6.2 Order boundary

Guest carts can be migrated to a database cart on login, and checkout ends in an order-creating call. Hiding a button is not enough.

- A recognizer module identifies preview items by reserved slug/id prefixes, and keeps working after the flag is switched off.
- Cart context: preview items accepted into the **guest cart only**; never added to a logged-in cart; excluded from the guest-to-database migration on login.
- Cart page: a cart containing preview items cannot proceed to checkout, and says why.
- Checkout: on direct entry, block before the payment form renders and return the user to the cart. The order-confirmation handler applies the same block **before** any database client or RPC call.
- Mixed carts cannot check out until preview items are removed.

**Permitted extent:** preview product detail → guest cart → quantity change/removal → local persistence. Nothing further. Verify zero database writes and zero RPC calls for preview items before calling this done.

---

## 7. NAVIGATION

`Çiftlik` and `Seçki` present in the header. Blog out. Keep the header calm — if the item count outgrows what the header handles gracefully, propose which items move to the footer rather than cramming or building a mega menu.

---

## 8. REDIRECTS

Once their content lands on `/ciftlik`, the source-content routes (`/ciftlikten` and `/emanet`, or the target's equivalents if they exist there) redirect to `/ciftlik`.

- **Last commit only** — keep them reachable during review for comparison.
- Use a **temporary (307)** redirect for now, in the route file. No `next.config` change.
- Report that they should become permanent at merge time.
- Internal links pointing at them are repointed directly to the new target.

---

## 9. COMMIT ORDER

1. Farm content source file, `/ciftlik` page, timeline component
2. Preview gate, local products, producer store pages, list/sort, product detail branch, cart and checkout boundaries
3. Homepage (three-product intro, card list removal) and `/secki` grid, navigation
4. **Admin blog removal only** — isolated, followed by build/typecheck and admin route verification
5. Public blog removal — routes, RSS, components, orphaned lib files, tests, sitemap, header/footer links
6. Temporary 307 redirects

---

## 10. ACCEPTANCE

- Preview flag tested **both on and off.** With it off: successful, empty and failing catalog results all produce no preview product, and existing 404 behavior is preserved.
- Order boundary tested without real credentials or a database: guest cart, mixed cart, refresh, direct checkout entry, login cart migration, order handler. Zero database writes and zero RPC calls for preview items.
- Timeline: all seven content states verified for heading/text/photo match; panel height and the position of the following section unchanged across every year and sub-step, desktop and mobile; keyboard and reduced-motion verified; no 2026; no `emanet` year notes present.
- Homepage: exactly three product links; no price, badge, stock, or purchase control in that section.
- `/secki`: grid at all three breakpoints, story and store links resolve, producer↔product mapping correct.
- Store: categories, sorting, out-of-stock state.
- Redirects, unknown slugs, and blog removal verified. Stale blog/homepage expectations in existing tests updated. Checks requiring live data are not counted as passes.
- `npm run build`, `npm run typecheck`, and the database-free tests pass — after the admin commit and again at the final SHA.
- Shared stylesheet diff is additions only, original content preserved byte-identically as a prefix.

### Final report

- Commit list; `git diff --name-only` and `--stat` against the branch's starting SHA
- **Separate diff for the shared stylesheet**
- Every new component, mapped to the existing pattern it was cloned from
- Every deviation taken under the latitude clause, with reasoning
- The exact guard condition, verbatim
- The furthest point a preview product can reach
- Placeholder teardown points: exactly which files and lines to delete
- Admin verification scope, and what could not be verified without credentials
- Test results, and review URLs
- Confirmation that `tailwind.config.*`, `globals.css`, fonts, `components/ui/*`, `supabase/`, `package.json`, the lockfile and `next.config` are unmodified, and that `/Users/mustafa/kabia-2.0`, `/Users/mustafa/kabia-brand` and `/Users/mustafa/kabia-latest` were not written to

---

## 11. FAILURE CONDITIONS

- Any commit, file, or git command outside `/Users/mustafa/kabia-2.0-revision`
- Invented farm facts, dates, or producer details
- A preview branch reachable without the explicit flag, or triggered by a failed query
- A preview product reaching checkout, an order, or the database
- Layout shift when the year changes
- Price or add-to-cart in the homepage three-product section
- A modified or deleted line in the shared stylesheet
- A new component created because existing ones "didn't quite fit," without flagging it
- Any migration, SQL, or Supabase CLI command
- A second parallel preview system alongside the target's existing fixtures
