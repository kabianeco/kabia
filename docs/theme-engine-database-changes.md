# Theme Engine — Database Changes

Applied through Supabase MCP against the connected project (`kabia`,
`xlubpolwuseafpcienql`, ap-northeast-1, Postgres 17).

## Migration files

Two local versioned migrations under `supabase/migrations/`:

1. `20260801200000_theme_engine.sql` — creates the tables, triggers, RLS,
   public reader RPC, internal validator, and the four write RPCs; seeds the
   default singleton (balanced + kabia_original + Instrument Sans/Instrument
   Serif, no overrides) and a seed revision (version 1).
2. `20260801210000_theme_engine_revision_model_fix.sql` — corrects the
   publish/restore revision-insert model so a revision row with `version = N`
   holds the configuration published **as** version N (the original inserted
   the OLD version number and collided with the seed revision on first
   publish). See "Revision model" below.

Both are applied to the live project. The local migration files are the source
of truth; remote schema matches them.

## Tables

### `public.site_theme_settings`

Singleton (`site_key = 'default'`, unique). Mutated **only** through the
SECURITY DEFINER RPCs; no INSERT/UPDATE/DELETE policy.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `site_key` | text, unique | `'default'` |
| `published_config` | jsonb, not null | the public theme |
| `draft_config` | jsonb, nullable | the in-progress draft |
| `published_version` | integer, default 1 | incremented on publish/restore |
| `schema_version` | integer, default 1 | |
| `published_at` / `published_by` | timestamptz / uuid→auth.users | |
| `draft_updated_at` / `draft_updated_by` | timestamptz / uuid→auth.users | |
| `created_at` / `updated_at` | timestamptz | `updated_at` touched by trigger |

### `public.site_theme_revisions`

Append-only history. A row's `version = N` holds the configuration that was
published **as** version N. UNIQUE `(site_key, version)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `site_key` | text | |
| `version` | integer | the published version this row represents |
| `config` | jsonb, not null | the config published as that version |
| `action` | text | `seed`, `publish`, `restore` |
| `publication_note` | text, nullable | |
| `created_at` | timestamptz | |
| `created_by` | uuid→auth.users, nullable | null only for the seed |

`trg_site_theme_revisions_immutable` raises on UPDATE/DELETE (mirror of
`admin_audit_logs`). The seed row has `created_by = null`.

## RLS and grants

Both tables have RLS enabled.

- `site_theme_settings`: SELECT policy `site_theme_settings_admin_read` for
  `authenticated` `USING (public.has_admin_role())`. **anon has no SELECT**.
  No INSERT/UPDATE/DELETE policy — RPCs own all writes.
- `site_theme_revisions`: SELECT policy `site_theme_revisions_admin_read` for
  `authenticated` `USING (public.has_admin_role())`. **anon has no SELECT**.
  No write policy; the append-only trigger is a backstop.

```sql
revoke all on public.site_theme_settings  from anon, authenticated;
revoke all on public.site_theme_revisions from anon, authenticated;
grant  select on public.site_theme_settings  to authenticated;
grant  select on public.site_theme_revisions to authenticated;
```

Because RLS cannot hide individual columns, public reads go through a safe RPC
rather than the table.

## RPCs

All are `SECURITY DEFINER`, `set search_path = public, pg_temp` (or `pg_temp`
for immutable helpers), re-derive the actor from `auth.uid()` + `user_roles`
inside the body, and revoke EXECUTE from `PUBLIC`/`anon`.

| Function | Returns | Granted to | Purpose |
|---|---|---|---|
| `get_published_site_theme()` | jsonb | anon, authenticated, service_role | The **only** public read path; returns `published_config` alone. |
| `is_valid_theme_config(p_config jsonb)` | boolean | (internal) | Coarse structural defence-in-depth against arbitrary JSON (the Zod schema is the primary validator). |
| `save_site_theme_draft(p_config jsonb)` | boolean | authenticated, service_role | Replaces the draft with a validated config. |
| `discard_site_theme_draft()` | boolean | authenticated, service_role | Clears the draft. |
| `publish_site_theme(p_note text)` | integer (new version) | authenticated, service_role | Atomic publish. |
| `restore_site_theme_version(p_version int, p_note text)` | integer (new version) | authenticated, service_role | Copies a historical config forward as a new version. |

Each write RPC calls `public.log_admin_action()` so the actor is recorded with
the server-derived identity.

## Revision model (corrected)

A revision row with `version = N` holds the configuration published **as**
version N:

- **Seed**: `published_version = 1`, revision `version = 1` holds the seed config.
- **Publish**: validates the draft → `v_next = published_version + 1` →
  inserts revision `version = v_next` with the **promoted draft** (action
  `publish`) → updates `published_config`, `published_version = v_next`,
  synchronizes the draft → audits `theme.publish`.
- **Restore** version *P* (current *C*): `v_next = C + 1` → inserts revision
  `version = v_next` with version *P*'s config (action `restore`) → updates
  the singleton → audits `theme.revision_restore`. The historical revision
  *P* is **never** mutated.

This satisfies the spec's invariant: restoring version 3 while current is 6
creates a new version 7 containing version 3's configuration. The earlier
implementation (snapshot the OLD config under the OLD version number)
collided with the seed revision on the first publish; the follow-up migration
corrected it.

## Verification performed via MCP

1. Applied `theme_engine` then `theme_engine_revision_model_fix` through
   `supabase_apply_migration`.
2. Verified the seeded singleton (`published_version = 1`, balanced,
   kabia_original, draft null) and the seed revision (version 1, action
   `seed`).
3. Ran `supabase_get_advisors` (security): the only WARNs are the project's
   pre-existing `*_security_definer_function_executable` pattern, documented
   in `20260801001000_media_listing_and_grants_hardening.sql` as intentional
   (each definer function re-checks the role in its own body). No new
   advisor regressions were introduced.
4. Ran the DB-backed test suite
   (`tests/theme-engine-auth.test.ts` with `--env-file=.env.local`) covering:
   anon reads published via the RPC; anon is denied on both tables and the
   save-draft RPC; admin saves a draft without leaking it to public; atomic
   publish increments version, creates a revision, writes an audit event with
   the server-derived actor; restore creates a new version without mutating
   history; revisions are append-only. All 8 pass.
5. Reset the live singleton back to the clean seed default after testing.

## Rollback

Drop the five RPCs (and `is_valid_theme_config`), then the two tables. The
application degrades to the default balanced + Kabia Original theme when the
RPC/row is missing, so the storefront stays rendered.