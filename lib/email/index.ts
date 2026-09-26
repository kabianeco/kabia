/**
 * Group B public surface. Sending itself is not wired in this step —
 * these builders only produce `{ subject, html, text }`.
 */
export { buildEmail, escapeHtml, formatTRY, logoUrl, siteUrl } from "./layout";
export type { EmailCta, EmailResult, LayoutInput } from "./layout";
export { welcomeEmail } from "./welcome";
export type { WelcomeInput } from "./welcome";
export { orderReceivedEmail } from "./order-received";
export type { OrderReceivedInput } from "./order-received";
export {
  carrierTrackingUrl,
  orderShippedEmail,
} from "./order-shipped";
export type { OrderShippedInput } from "./order-shipped";
export { orderDeliveredEmail } from "./order-delivered";
export type { OrderDeliveredInput } from "./order-delivered";
export { adminPasswordResetEmail } from "./password-admin-reset";
export type { AdminPasswordResetInput } from "./password-admin-reset";
export type {
  OrderAddressInput,
  OrderItemInput,
  OrderSummaryInput,
} from "./order-types";
