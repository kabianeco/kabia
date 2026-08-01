# Admin operations

Day-to-day procedures for the Kabia dashboard. For *why* things are built this
way, see `admin-media-architecture.md`.

---

## Media library — `/admin/media`

### Uploading

Drag images onto the drop zone, or use **dosya seçin** — drag-and-drop is never
the only route. Several files can be selected at once; they upload one at a
time, each with its own outcome, so one failure does not take the batch down.

| | |
|---|---|
| Formats | JPEG, PNG, WebP, AVIF |
| Maximum size | 10 MB |
| SVG | **Not accepted.** Nothing here sanitises SVG, and it can carry script. |
| Stored at | `product-media/YYYY-MM/<name>-<random>.<ext>` |

The file's **actual bytes** are checked against its declared type. A `.png` that
is really something else is rejected with
*"Dosya içeriği geçerli bir görsel değil."* — renaming a file does not get it in.

Width and height are read from the image header during upload; no resizing
happens. Originals are kept at full resolution and `next/image` produces the
responsive variants the storefront serves.

### Organising

- **Görünen ad** — replaces the filename in listings. Cosmetic.
- **Alternatif metin** — read by screen readers and search engines. Tiles
  without it are flagged *"Alt metni eksik"*. When a product uses the image, this
  text is copied in as a starting point and stays editable per product.

Search covers filename, display name and alt text. Filters: type and sort order.
Listing is paginated server-side — the browser never receives the whole bucket.

### Deleting

An image **in use by any product cannot be deleted.** The preview names and
links the products using it; detach it there first. This is enforced on the
server, not just by hiding the button.

For an unused image, deletion removes the Storage object and records the change
in the audit log. An ordinary administrator leaves a soft-deleted catalogue row
behind; a super admin's delete also purges the row.

---

## Product images

In **Ürün oluştur** and **Ürün düzenle**, under *Görseller*:

- **Medyadan seç** — opens the library, with search and type filter. Select one
  or more, confirm. No URL copying.
- **Yeni görsel yükle** — uploads and attaches in one step; the file also joins
  the library.
- **URL ile görsel ekle** — for images hosted elsewhere. Retained for
  compatibility with older products.

Then:

- **Ana görsel yap** sets the primary image — the one used in listings and
  social previews. The first image a product receives becomes primary
  automatically.
- **Yukarı / Aşağı** reorder the gallery. Order is saved and restored exactly.
- **Kaldır** detaches an image from the product; it stays in the library.
  Removing the primary promotes the next remaining image.

Selections survive a validation error, so a rejected save does not cost the
images. Changes reach the public store on save — no redeploy.

---

## Administrator roles

| | `admin` | `super_admin` |
|---|---|---|
| Products, stock, orders, customers, media, content | ✓ | ✓ |
| Sensitive settings | | ✓ |
| Add administrators, change roles, revoke | | ✓ |
| All audit logs | | ✓ |
| Purge a soft-deleted media record | | ✓ |

### Revoking access

Change or deactivate the role in **Yöneticiler**. That is the whole procedure.

The person's **next request to any admin route is denied** — the role is re-read
from the database on every request, never taken from their token. They land once
on `/admin/unauthorized` and stay there.

They do **not** need to clear cookies, clear cache, or sign out, and neither do
you. Their customer session keeps working normally; they simply lose the
dashboard. Their password is not touched.

Restoring the role works the same way, immediately, on the same browser session
with no clearing of anything.

> **Historical note.** Before this was fixed, revoking a role while the person
> was inside the dashboard left them bouncing around an error screen until they
> hard-refreshed, which made it look like a cookie or cache problem. It was not:
> the authorization check was skipped on client-side navigations. See
> `admin-media-architecture.md` §10.

---

## Testing

```bash
npm run lint          # 2 pre-existing errors, 2 pre-existing warnings
npm run typecheck     # 8 pre-existing errors in tests/admin-authorization.test.ts
npm run test          # 107 pass
npm run build
```

### Role-revocation suite

Needs credentials and a running server, so it is separate from `npm test`:

```bash
npm run dev                    # or npm start, in another terminal
npm run test:role-revocation
```

It creates two throwaway accounts, signs in as both, has the super admin revoke
the other's role, and asserts the denial is a single stable redirect with no
loop — including on the RSC soft-navigation path, which is where the original
bug lived. It deletes both accounts afterwards. Without `.env.local` or a
server, it skips rather than failing.

---

## Known operational limits

- A page already open in a revoked administrator's browser keeps showing what it
  rendered until they navigate. Nothing polls authorization, deliberately. The
  next request denies.
- Leaked-password protection is disabled on this Supabase project. Pre-existing
  configuration; enable it in Auth settings if wanted.
- Images uploaded directly through the Supabase dashboard bypass the app and
  will not appear in the library.
- There is no in-place "replace this image's bytes" action. Upload a new asset
  and repoint the product — safer, and it keeps the audit trail honest.
