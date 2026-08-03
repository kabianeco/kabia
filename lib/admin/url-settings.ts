/**
 * SEC-06: positive URL-scheme validation for site-setting string values that
 * are rendered as link `href`, image URL, redirect destination, canonical
 * URL, or external resource URL.
 *
 * The database-side guard (`site_settings_no_script_check`, strengthened by
 * migration `20260803010000_site_settings_url_scheme_guard.sql`) is a
 * *negative* check that blocks dangerous schemes across ALL string settings.
 * This module is the *positive* per-key check: it knows which keys are
 * rendered as URLs and what schemes each one is allowed to use.
 *
 * Together the two layers mean neither a missed DB constraint nor a missed
 * app-key config alone can accept a dangerous URL.
 *
 * Allowed schemes (per key kind):
 *   - same-origin relative path: "/path" (must NOT start with "//")
 *   - https:                     (the default remote scheme)
 *   - mailto:                    (only for contact-email-style href)
 *   - tel:                       (only for phone-style href)
 *
 * Always rejected:
 *   - data:, javascript:, vbscript:, file:, blob:
 *   - protocol-relative "//host"
 *   - control characters (including NUL, CR, LF, ESC)
 *   - encoded scheme bypasses such as "%64ata:" or "\u0064ata:" — the URL is
 *     inspected after lowercasing only the scheme prefix and decoded of any
 *     percent-encoded control chars in the scheme position
 */

/** Keys whose values are rendered as navigation href sinks. */
export const HREF_SETTING_KEYS = new Set<string>([
  "shop_banner_cta_href",
  // social_* are rendered as <a href> in the footer/header and are remote https:
  "social_instagram",
  "social_facebook",
  "social_x",
])

/** Keys whose values are rendered as <img>/next/image src sinks. */
export const IMAGE_SETTING_KEYS = new Set<string>([
  "shop_banner_image_url",
  "seo_social_image",
])

const ALLOWED_SCHEMES_HREF = new Set(["https:", "mailto:", "tel:"])
const ALLOWED_SCHEMES_IMAGE = new Set(["https:"])

/** Strips percent-encoded control-char equivalents from the scheme slot. */
function decodeScheme(value: string): string {
  // Only decode the first ~12 chars (scheme slot). Decoding whole value here
  // is unnecessary for scheme detection and could mask intentional %20 etc.
  const head = value.slice(0, 12)
  try {
    return decodeURIComponent(head)
  } catch {
    return head
  }
}

export interface ValidationResult {
  ok: boolean
  reason?: string
}

/**
 * Validates that `value` is a URL of one of the allowed schemes for the
 * given setting `key`. Returns `{ ok: true }` if the key is not a known
 * URL-typed key (i.e. this validator does not constrain it — the DB guard
 * and the generic string schema still apply).
 */
export function validateSettingUrl(value: string, key: string): ValidationResult {
  // If the key isn't one we render as a URL sink, no positive constraint is
  // defined here; allow the row's bare string schema to be the sole arbiter.
  const isHref = HREF_SETTING_KEYS.has(key)
  const isImage = IMAGE_SETTING_KEYS.has(key)
  if (!isHref && !isImage) return { ok: true }

  const trimmed = (value ?? "").trim()
  if (trimmed === "") return { ok: true } // empty is the "unset" state

  // Reject any embedded C0/DEL control char before further parsing: this is
  // both a log/render risk and a known obfuscation vector for scheme matching.
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return { ok: false, reason: "URL, kontrol karakterleri içeremez." }
  }

  // Reject protocol-relative //host up front (URL() parses these as https://)
  if (trimmed.startsWith("//")) {
    return { ok: false, reason: "Protokol göreceli URL'lere izin verilmez." }
  }

  // Same-origin relative path is the most common value for image URL settings
  // (e.g. /images/almonds-drying.jpg). Must start with exactly one slash.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    // Block any backslash-equivalent or path-traversal-style escape.
    if (trimmed.includes("\\")) {
      return { ok: false, reason: "Geçersiz yol." }
    }
    return { ok: true }
  }

  // Decode a percent-encoded scheme prefix and reject dangerous schemes
  // before URL() parsing, so "%64ata:" or "%6aavascript:" cannot slip past.
  const decodedHead = decodeScheme(trimmed).toLowerCase()
  for (const bad of ["data:", "javascript:", "vbscript:", "file:", "blob:"]) {
    if (decodedHead.startsWith(bad)) {
      return { ok: false, reason: "İzin verilmeyen URL şeması." }
    }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: "Geçerli bir URL girin." }
  }

  const allowed = isImage ? ALLOWED_SCHEMES_IMAGE : ALLOWED_SCHEMES_HREF
  if (!allowed.has(parsed.protocol)) {
    return { ok: false, reason: `İzin verilmeyen şema: ${parsed.protocol}` }
  }

  // Reject user-info credential leakage like https://user:pass@host/...
  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "Kimlik bilgisi içeren URL'lere izin verilmez." }
  }

  return { ok: true }
}