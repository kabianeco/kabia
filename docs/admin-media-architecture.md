# Media library & admin authorization — architecture

Written against `/Users/mustafa/kabia-latest` and the connected Supabase project
`kabia` (`xlubpolwuseafpcienql`), verified over MCP before any change was applied.
No secret values appear in this repository.

Companion documents:

- `admin-media-database-changes.md` — every schema, policy and Storage change.
- `admin-operations.md` — day-to-day operator procedures.
- `admin-architecture.md` — the pre-existing dashboard architecture, unchanged.

---

## 1. What was already here

The dashboard was not greenfield, and most of it was left alone.

| Area | State before this work |
|---|---|
| Storage bucket | `product-media` existed, public read, 5 MB, JPEG/PNG/WebP/AVIF |
| Storage policies | Admin-only insert/update/delete/select, via `public.has_admin_role()` |
| `/admin/media` | Listed `storage.objects` directly — no metadata, search, or pagination |
| Product images | `products.main_image_url` (primary) + `product_images` (gallery) |
| Gallery ordering | `product_images.sort_order` |
| Per-image alt text | `product_images.alt_text` |
| Storage back-reference | `product_images.storage_path` |
| Authorization helper | `lib/admin/auth.ts` — `getAdminSession()`, `requireAdmin()` |
| Audit log | `admin_audit_logs` + `log_admin_action()` RPC, actor from `auth.uid()` |

Two conclusions followed, and both shaped everything below:

1. **No new product-media relationship was needed.** `products.main_image_url`
   plus `product_images(sort_order, alt_text, storage_path)` already expresses
   one primary image, an ordered gallery and per-image alt text. A
   `product_media` join table would have been a second, competing image model
   for no gain, so it was **not** created.
2. **No second bucket was needed.** `product-media` already had correct
   policies; it was reused and its size limit raised.

---

## 2. What was missing

The media manager had no *catalogue*. It enumerated Storage objects, which
meant:

- no alt text, display name, dimensions, or uploader attribution;
- no search, no type filter, no sorting, no total count;
- pagination was impossible — the page walked every `YYYY-MM/` prefix on each
  render, one Storage request per folder;
- and, most importantly, **no way to pick an image from a product**. An operator
  had to open `/admin/media`, copy a URL, and paste it into the product editor.

---

## 3. Media metadata model

`public.media_assets` — one row per Storage object.

```
id                uuid pk
bucket_id         text not null default 'product-media'
object_path       text not null          -- the canonical reference
original_filename text not null          -- kept as metadata only
display_name      text
mime_type         text not null          -- constrained to the four allowed types
file_size         bigint not null
width, height     integer                -- probed server-side from the bytes
alt_text          text
created_by        uuid not null -> auth.users(id)
created_at, updated_at, deleted_at
unique (bucket_id, object_path)
```

### Why no URL column

The public URL is **derived** from `(bucket_id, object_path)`, never stored. A
stored URL would rot the moment the project ref or bucket name changed, and a
stored *signed* URL would expire — which is exactly the failure the brief warns
about. `object_path` is the stable identity; the URL is a rendering detail.

### Why no foreign key to products

Product imagery predates this table. The seeded catalogue points at
`picsum.photos` placeholders that have no `media_assets` row at all. A foreign
key from `product_images.storage_path` would have forced either rewriting that
history or refusing those products. Reference safety is therefore enforced in
the application (§7) rather than by a constraint, and historical products keep
working untouched.

### Soft delete

`deleted_at` is set *before* the Storage object is removed. If the Storage call
then fails, the soft delete is rolled back, so the states that never occur are
"a product pointing at a missing file" and "a row nobody can see". Hard deletion
of the row is super-admin only; an ordinary administrator leaves the record
behind, which is itself part of the trail.

---

## 4. Storage architecture

Bucket `product-media`, **public read**, 10 MB limit (raised from 5 MB),
MIME-restricted to `image/jpeg`, `image/png`, `image/webp`, `image/avif`.

Public read is the correct choice here, per the brief's Option A: product
photographs are rendered to anonymous visitors on every storefront page. Making
the bucket private would put an expiring signed URL behind every product image
in the shop — the failure mode the brief explicitly rules out. The bucket is
public for *reads only*; every mutating operation is gated on
`public.has_admin_role()`.

SVG is **not** accepted. Nothing in this application sanitises SVG, and it is a
script-execution vector served from the project's own storage host.

### Object naming

```
YYYY-MM/<slugified-stem>-<8 hex>.<ext>
```

- The stem is derived from the original filename, lowercased and stripped to
  `[a-z0-9-]`, capped at 48 characters.
- The extension comes from the **probed** MIME type, never the supplied one.
- A random suffix makes collisions practically impossible, and `upsert: false`
  means a collision would error rather than silently overwrite someone's image.
- Path traversal is impossible by construction: the path is *built*, not taken.

---

## 5. Upload validation

Validated on the client (fast, specific errors) and re-validated on the server,
which is the boundary that counts.

| Check | Client | Server | Database |
|---|---|---|---|
| Non-empty | ✓ | ✓ | |
| Size ≤ 10 MB | ✓ | ✓ | bucket `file_size_limit` |
| Declared MIME allowed | ✓ | ✓ | bucket `allowed_mime_types` |
| **Bytes match the declared type** | | ✓ | |
| Dimensions | | ✓ (probed) | |
| Caller is an administrator | | ✓ | Storage policy + RLS |

The byte-level check is `lib/admin/image-probe.ts`. It parses only container
headers — PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X, AVIF `ispe` — so it is O(1) in
file size and cannot be turned into a decompression bomb. A file claiming
`image/png` whose bytes are not a PNG is rejected before anything is written.
This was verified: an HTML payload renamed `.png` is refused with
*"Dosya içeriği geçerli bir görsel değil."*

The same pass yields intrinsic width and height, which is where `media_assets`
dimensions come from — no image library dependency was added.

---

## 6. Authorization for media

Every media operation runs through the **administrator's own Supabase session**.
The service-role key is never used for media, and never reaches the browser.

A revoked administrator is stopped three times over:

1. `adminContext("manageMedia")` in the server action / route handler;
2. `product_media_admin_insert` on `storage.objects`;
3. `media_assets_admin_insert` on the catalogue row.

`media_assets_admin_insert` additionally pins `created_by = auth.uid()`, so an
administrator cannot attribute an upload to somebody else even by posting a
crafted row.

The catalogue has **no anon or customer policy at all** — it is administrative
metadata (who uploaded what, when, under which original filename). Public
product images are unaffected, because a public bucket serves
`/storage/v1/object/public/...` without consulting any policy.

---

## 7. Deletion and reference safety

Before deleting, `loadMediaUsage()` resolves which products reference the asset,
matching on **both** `product_images.storage_path` and `product_images.image_url`
**and** `products.main_image_url`. Both spellings are necessary: rows created
through the library carry a path, while historical rows carry only a URL.
Checking one would let a live storefront image be deleted.

If anything references it, deletion is refused and the referencing products are
**named and linked**, so the operator can go and detach them rather than being
told "no" with no way forward. The UI hides the delete control; the server
refuses independently.

Sequence, when unreferenced:

1. soft-delete the catalogue row;
2. remove the Storage object;
3. on failure, **roll the soft delete back** and report;
4. on success, hard-delete the row if the actor is a super admin;
5. write an audit record.

---

## 8. Product integration

`components/admin/media/media-picker.tsx` is a `<dialog>`-based picker used by
both product create and product edit. It reads `/admin/media/api`, which
re-authorises on its own — a route handler is directly addressable, so it cannot
assume the layout above it vouched for the caller.

The picker fetches **one page at a time**; the whole bucket is never pulled into
the browser. Search is debounced at 300 ms and requires two characters.

On confirm:

- selected assets are appended, skipping ones already attached;
- alt text carries over from the library when set, and stays editable per
  product — the same photograph can warrant a different description elsewhere;
- the first image a product ever receives becomes its primary image, so the
  common case needs no second click.

Existing behaviour is preserved: direct upload from inside the editor still
works, and manual URL entry remains, because historical products depend on it.

Ordering is `product_images.sort_order`, written from list position on save.
Primary is `products.main_image_url`, tracked by URL rather than position — so
reordering the gallery does not silently change which image is primary. Removing
the primary promotes the next remaining image, because `main_image_url` is
`NOT NULL`.

---

## 9. Public store delivery

Unchanged, deliberately. The storefront already reads `products.main_image_url`
and `product_images`, and `next.config.ts` already allow-lists the Supabase host
for `next/image`. Assigned images therefore appear with no redeploy, optimised
and responsive, and the existing `revalidatePath()` calls in the product save
action cover `/`, `/shop` and `/shop/[slug]`.

Verified: a product created through the picker renders its primary image and
gallery on `/shop/medya-testi-bademi` through `/_next/image`, while seeded
picsum products continue to render unchanged.

---

## 10. The role-revocation refresh loop

### Root cause

Authorization redirects lived **only in the protected layout**
(`app/admin/(protected)/layout.tsx`). Page-level guards (`requireAdmin()`,
`adminContext()`) **threw** `AdminAuthError` instead of redirecting, because they
were designed for server actions, where throwing is correct.

On a **soft navigation** between two routes in the same layout group, Next.js
reuses the already-rendered layout from the client router cache and re-renders
only the page. The layout's guard therefore never ran. The page's guard threw,
and the throw landed in `app/admin/(protected)/error.tsx`.

The result: a revoked administrator was pinned inside a fully-rendered admin
shell showing an error panel. Every in-app link was another soft navigation into
the same group, so it threw again. The error boundary's own "Genel bakışa dön"
link pointed at `/admin` — also in the group — and its "Tekrar dene" button
re-rendered the same failing page. Each attempt issued more RSC requests and
more console errors while the URL barely moved.

### Why it looked like `/admin` specifically

`/admin` is the group's index, the post-login landing route, and the target of
the error boundary's own recovery link. Every attempt to escape routed back
through it, so that is where the operator kept ending up.

### Why clearing cookies appeared to fix it

Clearing cookies, signing out, or hard-refreshing all force a **full document
request**. That re-runs the layout, whose guard was correct, and the redirect to
`/admin/unauthorized` fires normally. The cookies were never the problem — the
full page load was the cure, and cookie-clearing was just one way to trigger one.

### The fix

`requireAdminPage()` / `adminPageContext()` in `lib/admin/auth.ts`: the same
authoritative role read, but **redirecting** rather than throwing.

```
no session              → /admin/login
session, no admin role  → /admin/unauthorized
admin, wrong permission → /admin/unauthorized
admin owing a password  → /admin/sifre-degistir
otherwise               → render
```

Every one of those targets lies outside the layout group, so a redirect can
never resolve back into the route that issued it.

All 16 pages in `app/admin/(protected)/` now call it, **and so does the layout** —
both go through one helper, so the two layers cannot drift apart. Server actions
keep the throwing `requireAdmin()` / `adminContext()`, because an action must
return a form error rather than navigate.

The role is still read fresh from `user_roles` on every request; it is never
taken from a JWT claim or from `user_metadata`. No timer, flag, debounce,
forced sign-out or cookie manipulation was added — the brief prohibits all of
them, and none was needed once the guard ran in the right place.

### Layering

| Layer | Responsibility | Fails how |
|---|---|---|
| `proxy.ts` | Session presence only, `/admin/*` | redirect to `/admin/login` |
| Protected layout | Role check on document requests | `redirect()` |
| **Every page** | Role + permission, on *every* render | `redirect()` |
| Server actions / route handlers | Role + permission | throw / 401-403 |
| RLS + Storage policies | The real boundary | zero rows / policy violation |

Middleware deliberately does **not** check roles: treating an edge check as
authorization means trusting a token that may have been revoked a second ago.

---

## 11. Cache and session decisions

- Every admin route is `dynamic = "force-dynamic"`; the production build reports
  all of them as `ƒ`, so none is statically prerendered.
- `/admin/media/api` sets `cache-control: no-store`.
- `getAdminSession()` is wrapped in React `cache()`, which is **per-request** —
  it dedupes the layout's and the page's lookup within one render, and shares
  nothing across users or requests.
- `force-dynamic` was not the fix and is not load-bearing for correctness; the
  guard placement is. It is there so private admin data is never shared through
  a cache.

---

## 12. Known limitations

- A page already rendered in the browser keeps showing its content until the
  next navigation. This is inherent to server rendering and is not a leak of new
  data — the next request denies. Nothing polls authorization, by design.
- Dimensions come from container headers. A malformed-but-decodable image may
  record `null` dimensions; the upload still succeeds and the library shows
  "Bilinmiyor".
- Replacing an image's bytes in place is not offered. Upload a new asset and
  repoint the product — safer, and it keeps the audit trail honest.
- `loadMediaUsage()` resolves usage for one page of assets at a time. That is
  bounded, but it is two queries per page rather than a single join.
- The media library shows only assets in the catalogue. Objects uploaded
  directly through the Supabase dashboard, bypassing the app, will not appear.
