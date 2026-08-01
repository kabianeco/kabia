import "server-only"

/**
 * The `admin` username alias.
 *
 * Supabase Auth has no username concept — password authentication is keyed on
 * an email or a phone number. So "admin" is an application-level alias that is
 * resolved *here*, on the server, and nowhere else.
 *
 * There is deliberately no route handler, RPC, or public endpoint that maps a
 * username to an email. The mapping exists only inside the sign-in server
 * action, so it cannot be used to discover which accounts exist. Both variables
 * are read without a NEXT_PUBLIC_ prefix and therefore never reach the browser
 * bundle.
 */

const DEFAULT_USERNAME = "admin"
const DEFAULT_EMAIL = "admin@kabia.local"

export function bootstrapUsername(): string {
  return (process.env.ADMIN_BOOTSTRAP_USERNAME || DEFAULT_USERNAME).trim().toLocaleLowerCase("en")
}

export function bootstrapEmail(): string {
  return (process.env.ADMIN_BOOTSTRAP_EMAIL || DEFAULT_EMAIL).trim().toLocaleLowerCase("en")
}

/**
 * Turns whatever was typed into the identifier field into an email to
 * authenticate with, or null when it is neither an email nor the configured
 * alias.
 *
 * Null is treated by the caller exactly like a wrong password — the response is
 * identical either way, so this cannot be used to probe for valid usernames.
 */
export function resolveAdminIdentifier(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  if (raw.includes("@")) {
    const email = raw.toLocaleLowerCase("en")
    // Cheap shape check; Supabase performs the real validation.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  }

  return raw.toLocaleLowerCase("en") === bootstrapUsername() ? bootstrapEmail() : null
}

/**
 * One message for every failure mode: unknown alias, unknown email, wrong
 * password, and "correct password but not an administrator" are
 * indistinguishable from the outside.
 */
export const GENERIC_LOGIN_ERROR = "Kullanıcı adı veya şifre hatalı."
