import "server-only";

import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  resolveThemeSafe,
  resolveDefaultTheme,
  type ResolvedTheme,
} from "@/lib/theme-engine/resolve";
import { parseThemeConfig, isValidThemeConfig } from "@/lib/theme-engine/schema";
import { DEFAULT_THEME_CONFIG, SITE_THEME_KEY, SITE_THEME_TAG } from "@/lib/theme-engine/types";
import type { ThemeConfiguration } from "@/lib/theme-engine/types";

/**
 * Theme settings access layer.
 *
 * Two distinct surfaces:
 *
 *   1. The public storefront reads *only* the published configuration, through
 *      a safe RPC `get_published_site_theme()` that returns the published
 *      JSONB and nothing else. The result is tag-cached (`SITE_THEME_TAG`) and
 *      degrades to the default balanced + Kabia Original theme on any failure.
 *      A failure is never persisted as the authoritative cached value — the
 *      cache only stores successfully-validated results.
 *
 *   2. Administrators read draft + revision history through their own
 *      cookie-bound session, so RLS/role checks apply on every request. These
 *      are never cached.
 *
 * The split mirrors `lib/settings.ts`: a shared anon read for the storefront,
 * a per-request session read for the dashboard.
 */

export { SITE_THEME_TAG };

export class ThemeSettingsReadError extends Error {
  readonly operation: "published" | "settings" | "revisions";

  constructor(operation: "published" | "settings" | "revisions") {
    super("Tema ayarları şu anda okunamıyor.");
    this.name = "ThemeSettingsReadError";
    this.operation = operation;
  }
}

/** Admin-page view of the singleton row. */
export interface ThemeSettingsRow {
  siteKey: string;
  publishedConfig: ThemeConfiguration;
  draftConfig: ThemeConfiguration | null;
  publishedVersion: number;
  schemaVersion: number;
  publishedAt: string | null;
  publishedBy: string | null;
  draftUpdatedAt: string | null;
  draftUpdatedBy: string | null;
}

export interface ThemeRevisionRow {
  version: number;
  config: ThemeConfiguration;
  action: string;
  publicationNote: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** Fallback theme used when Supabase is unreachable or the row is invalid. */
export const FALLBACK_RESOLVED_THEME: ResolvedTheme = resolveDefaultTheme();

/** Validate before a value is eligible to enter the shared theme cache. */
export function resolvePublishedThemeConfig(raw: unknown): ResolvedTheme {
  const config = parseThemeConfig(raw);
  if (!config) throw new ThemeSettingsReadError("published");
  return resolveThemeSafe(config);
}

/**
 * Public RPC boundary. Missing data, query failure, and invalid JSON all reject
 * before `unstable_cache` can store a value; only a validated theme resolves.
 */
export async function readPublishedThemeFromClient(
  client: SupabaseClient,
): Promise<ResolvedTheme> {
  try {
    const { data, error } = await client.rpc("get_published_site_theme");
    if (error || data == null) throw new ThemeSettingsReadError("published");
    return resolvePublishedThemeConfig(data);
  } catch (error) {
    if (error instanceof ThemeSettingsReadError) throw error;
    throw new ThemeSettingsReadError("published");
  }
}

/**
 * The resolved published theme, tag-cached for the storefront.
 *
 * Only validated results are cached. Failures throw from inside
 * `unstable_cache`; rejected executions are not successful cache entries. The
 * outer request catches the failure and supplies its own fallback, so a
 * transient outage never turns into an authoritative five-minute null theme.
 */
async function readPublishedThemeUncached(): Promise<ResolvedTheme> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ThemeSettingsReadError("published");
  const client = createClient(url, key, { auth: { persistSession: false } });
  return readPublishedThemeFromClient(client);
}

const cachedPublishedThemeReader = unstable_cache(
  readPublishedThemeUncached,
  ["kabia-site-theme"],
  { tags: [SITE_THEME_TAG], revalidate: 300 },
);

/**
 * The resolved published theme for the public site. Always returns a
 * `ResolvedTheme` — the default balanced theme on any failure. Suitable for
 * calling from `app/layout.tsx` during SSR with no flash.
 */
export async function getPublishedTheme(): Promise<ResolvedTheme> {
  try {
    return await cachedPublishedThemeReader();
  } catch {
    // Deliberately omit the Supabase/Postgres error object: it can contain
    // schema details. A failure is request-local and is never cached.
    console.error("[theme] Published theme unavailable; using the balanced fallback.");
  }
  return FALLBACK_RESOLVED_THEME;
}

/**
 * The raw published `ThemeConfiguration` (not resolved), for the admin editor's
 * "published" indicator. Admin-session only.
 */
export async function getThemeSettingsRow(
  supabase: SupabaseClient,
): Promise<ThemeSettingsRow | null> {
  const { data, error } = await supabase
    .from("site_theme_settings")
    .select(
      "site_key, published_config, draft_config, published_version, schema_version, published_at, published_by, draft_updated_at, draft_updated_by",
    )
    .eq("site_key", SITE_THEME_KEY)
    .maybeSingle();

  if (error) throw new ThemeSettingsReadError("settings");
  if (!data) return null;
  const row = data as {
    site_key: string;
    published_config: unknown;
    draft_config: unknown;
    published_version: number;
    schema_version: number;
    published_at: string | null;
    published_by: string | null;
    draft_updated_at: string | null;
    draft_updated_by: string | null;
  };

  const publishedConfig = parseThemeConfig(row.published_config) ?? DEFAULT_THEME_CONFIG;
  const draftConfig = row.draft_config ? parseThemeConfig(row.draft_config) : null;

  return {
    siteKey: row.site_key,
    publishedConfig,
    draftConfig,
    publishedVersion: row.published_version,
    schemaVersion: row.schema_version,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    draftUpdatedAt: row.draft_updated_at,
    draftUpdatedBy: row.draft_updated_by,
  };
}

/**
 * Server-side validation hook used by the admin actions before calling the
 * `save_site_theme_draft` RPC. Mirrors the RPC's own check, so the user sees a
 * Turkish field error rather than a PostgREST error object.
 */
export function validateDraftConfig(raw: unknown): ThemeConfiguration | null {
  if (!isValidThemeConfig(raw)) return null;
  return parseThemeConfig(raw);
}

/** Paginated revision history for the admin revision panel. */
export async function listThemeRevisions(
  supabase: SupabaseClient,
  page: number,
  perPage = 10,
): Promise<{ rows: ThemeRevisionRow[]; total: number }> {
  const safePage = Math.max(1, page | 0);
  const offset = (safePage - 1) * perPage;

  const { data, error, count } = await supabase
    .from("site_theme_revisions")
    .select("version, config, action, publication_note, created_at, created_by", { count: "exact" })
    .eq("site_key", SITE_THEME_KEY)
    .order("version", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw new ThemeSettingsReadError("revisions");
  if (!data) return { rows: [], total: count ?? 0 };
  const rows = (data as {
    version: number;
    config: unknown;
    action: string;
    publication_note: string | null;
    created_at: string;
    created_by: string | null;
  }[]).map((r) => ({
    version: r.version,
    config: parseThemeConfig(r.config) ?? DEFAULT_THEME_CONFIG,
    action: r.action,
    publicationNote: r.publication_note,
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));

  return { rows, total: count ?? rows.length };
}

/** Resolve a draft (or published, when no draft exists) for the admin editor. */
export function resolveWorkingDraft(row: ThemeSettingsRow): {
  draft: ThemeConfiguration;
  hasDraft: boolean;
} {
  if (row.draftConfig) return { draft: row.draftConfig, hasDraft: true };
  return { draft: row.publishedConfig, hasDraft: false };
}
