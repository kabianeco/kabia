/**
 * Versions of the legal texts a customer accepts at registration. Recorded
 * with each consent row (public.customer_consents.document_version) so a
 * later change to a text does not rewrite what someone agreed to. Update the
 * matching value whenever the published text changes.
 */
export const CONSENT_VERSIONS = {
  terms: "2026-09-26",
  kvkk: "2026-09-26",
  explicitConsent: "2026-09-26",
} as const

/** The shape handle_new_user() reads from raw_user_meta_data.consents. */
export function registrationConsents(marketing: boolean) {
  return {
    terms: CONSENT_VERSIONS.terms,
    kvkk: CONSENT_VERSIONS.kvkk,
    marketing,
    explicit_consent: CONSENT_VERSIONS.explicitConsent,
  }
}
