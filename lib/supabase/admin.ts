import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client.
 *
 * `import "server-only"` above makes it a build error for any client component
 * to pull this module in, so the secret can never reach a browser bundle. The
 * key is read from SUPABASE_SERVICE_ROLE_KEY, which is deliberately not
 * prefixed with NEXT_PUBLIC_.
 *
 * This client bypasses Row Level Security completely. It is used for exactly
 * the operations that genuinely require the Auth Admin API and cannot be done
 * with an ordinary session:
 *
 *   - creating the bootstrap administrator
 *   - creating or inviting an administrator
 *   - reading auth-only fields (email, last_sign_in_at, banned_until)
 *   - clearing an administrator's session after revocation
 *
 * Every caller must independently verify the acting administrator first — see
 * requireAdmin() / requireSuperAdmin() in lib/admin/auth.ts. Nothing this
 * client returns is ever handed to the browser unfiltered.
 */

let cached: SupabaseClient | null = null

/** True when the deployment is configured for Auth Admin operations. */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export class MissingServiceRoleKeyError extends Error {
  constructor() {
    super(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local (never with a NEXT_PUBLIC_ prefix).",
    )
    this.name = "MissingServiceRoleKeyError"
  }
}

export function createSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new MissingServiceRoleKeyError()

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
