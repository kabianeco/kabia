/**
 * How long order records are kept after the customer deletes their account.
 *
 * ⚠ PENDING OWNER DECISION — the legal period is being settled with the
 * accountant (Turkish commercial and tax record-keeping rules). Change this
 * one value when it is decided; the deletion page, the account-deleted page
 * and the data export all read it.
 *
 * Nothing purges retained orders automatically. When an account is deleted,
 * its orders are detached (orders.user_id = null, customer_detached_at set)
 * and stay visible only to administrators. Any purge after this period must be
 * a separate, deliberate change.
 */
export const ORDER_RECORD_RETENTION_YEARS = 10
