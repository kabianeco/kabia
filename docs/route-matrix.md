# Route matrix

Every route in the merged application, where its behaviour and its appearance
came from, and what guards it.

`premium` = `kabia-premium-opus` · `website` = `kabia-website` (recovered from
`refs/stash^3`) · `new` = written for this merge in the premium language.

## Pages

| Target route | Functional source | Visual source | Auth | Status |
| --- | --- | --- | --- | --- |
| `/` | premium + website catalogue | premium (verbatim) | public | Done — intro, Three.js and section order untouched; product ledger now reads live products |
| `/shop` | website | new | public | Done — server-rendered, category + sort in the URL |
| `/shop/[slug]` | website | new | public | Done — gallery, variants, stock, cart, favourites, reviews |
| `/sepet` | website | new | public (guest cart supported) | Done |
| `/odeme` | website | new | **required** | Done — 3 steps, `create_order` RPC |
| `/giris` | website | new | public | Done — password, OAuth, reset, `?next=` |
| `/kayit` | website | new | public | Done |
| `/hesabim` | website | new | **required** | Done — stats, last order, recently viewed |
| `/hesabim/siparislerim` | website | new | **required** | Done |
| `/hesabim/siparislerim/[orderId]` | website | new | **required** | Done — timeline, reorder |
| `/hesabim/adreslerim` | website | new | **required** | Done |
| `/hesabim/favorilerim` | website | new | **required** | Done |
| `/hesabim/kart-bilgilerim` | website | new | **required** | Done |
| `/hesabim/bilgilerim` | website | new | **required** | Done — profile + password + email change |
| `/hesabim/bildirimler` | website | new | **required** | Done |
| `/blog` | website | new | public | Done — states plainly that there is no archive yet |
| `/_not-found` | new | new | public | Done |

## Redirects

| From | To | Code | Why |
| --- | --- | --- | --- |
| `/magaza` | `/shop` | 308 | The premium concept's store URL; the real shop lives at `/shop` |
| `/farm` | `/#ciftlik` | 308 | The premium homepage covers this as a section |
| `/contact` | `/#iletisim` | 308 | Same |

## Auth enforcement

There is no middleware — the source project had none, and adding one was not
required by any screen.

- `/hesabim/*` is guarded by `app/hesabim/layout.tsx`, which waits for the
  Supabase session to hydrate and then redirects to
  `/giris?next=<path>` when signed out.
- `/odeme` guards inside `checkout-flow.tsx`: session, then non-empty cart,
  then a selected address.
- **Row Level Security is the actual enforcement.** The client guards are
  navigation, not security: every read and write goes through the anon key, so
  Postgres policies decide what a session may see. A signed-out request to
  `/hesabim` returns a shell with no account data in it (asserted in
  `tests/routes.test.js`).

## Notes

- No route renders the pre-merge `kabia-website` design.
- No route exists in both a legacy and a premium version.
- Supabase auth callbacks were not changed: OAuth returns to
  `${origin}${next}` and password reset to `${origin}/hesabim/bilgilerim`,
  exactly as before.
