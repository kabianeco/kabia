-- ---------------------------------------------------------------------------
-- SEC-06: Positive URL-scheme validation for string-typed site settings.
--
-- The previous constraint (site_settings_no_script_check) only blocked narrow
-- script patterns (<script, javascript:, inline event-handler attributes).
-- It did NOT block the `data:`, `vbscript:`, `file:`, `blob:` schemes, the
-- protocol-relative `//` redirect carrier, or arbitrary C0 control characters
-- that could be used to defeat naive allowlists.
--
-- This migration replaces that constraint with a tighter one that:
--   * keeps the existing script-pattern block (defence in depth — never reads
--     as a script in any sink),
--   * bans strings that begin with a dangerous URL scheme,
--   * bans protocol-relative URLs (`//host`), which bypass same-origin checks,
--   * bans embedded C0/DEL control characters used to obfuscate prefixes.
--
-- It is a *negative* defence-in-depth constraint at the storage boundary, not
-- a positive per-key allowlist. The positive allowlist (per-key URL vs free
-- text) is enforced at the application layer, where each setting's intended
-- sink is known (see lib/admin/url-settings.ts). Both layers are required so
-- neither is a single point of failure.
--
-- Rollback: drop the new constraint and recreate the original by name.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  drop constraint if exists site_settings_no_script_check;

alter table public.site_settings
  add constraint site_settings_no_script_check check (
    value_type <> 'string'
    or (
         (value #>> '{}') !~* '(<\s*script|javascript\s*:|on[a-z]+\s*=)'
      -- Reject any string whose first non-whitespace run begins with a
      -- dangerous scheme, with optional whitespace around the colon, so
      -- trimmed titles and announcement text remain legal.
      and (value #>> '{}') !~* '^\s*(data|javascript|vbscript|file|blob)\s*:'
      -- Reject protocol-relative URLs, which bypass same-origin checks and
      -- are not legitimately produced by the admin UI for any setting.
      and (value #>> '{}') !~* '^\s*//'
      -- Reject any C0/DEL control character. These never appear in the
      -- seeded plain-text settings, so banning them outright is safe and lets
      -- the application layer focus on scheme checks without worrying about
      -- control-char obfuscation.
      and (value #>> '{}') !~* '[\x00-\x1f\x7f]'
    )
  );

comment on constraint site_settings_no_script_check on public.site_settings is
  'Negative defence-in-depth: blocks script patterns AND dangerous URL schemes (data:, javascript:, vbscript:, file:, blob:), protocol-relative // URLs, and C0 control characters in string-typed settings. The positive per-key URL allowlist lives in lib/admin/url-settings.ts.';