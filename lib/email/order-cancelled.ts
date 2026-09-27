/**
 * Group B · Sipariş iptali — order cancelled.
 *
 * Trigger: an admin moves the order to `iptal_edildi` (status action or
 * super-admin override), after the restock RPC has committed. Always
 * transactional (preference-independent), idempotent, resendable.
 *
 * Copy depends on the payment method and never promises what cannot
 * happen — there is no payment-provider integration, so no card charge
 * ever exists:
 *   cod / card   → no payment was taken.
 *   bank_transfer→ if a payment was received, we will contact them
 *                  about the refund.
 *   unknown      → neutral contact line, no promise.
 */
import { buildEmail, escapeHtml, siteUrl, type EmailResult } from "./layout";

export type CancelPaymentMethod = "cod" | "bank_transfer" | "card" | null;

export interface OrderCancelledInput {
  orderNumber: string;
  /** Snapshot method code (`payment_method_snapshot.method`), null when unknown. */
  paymentMethod?: CancelPaymentMethod;
}

export function cancelPaymentLine(method: CancelPaymentMethod): string {
  if (method === "cod" || method === "card") {
    return "Kapıda ödeme seçtiğiniz için herhangi bir ödeme alınmadı.";
  }
  if (method === "bank_transfer") {
    return "Havale / EFT ile bir ödeme ulaştıysa, iade için sizinle iletişime geçeceğiz.";
  }
  return "Ödeme ile ilgili bir işlem gerekirse sizinle iletişime geçeceğiz.";
}

export function orderCancelledEmail(input: OrderCancelledInput): EmailResult {
  const orderNumber = input.orderNumber.trim();
  const subject = `Siparişiniz iptal edildi (${orderNumber})`;
  const paymentLine = cancelPaymentLine(input.paymentMethod ?? null);
  const orderUrl = `${siteUrl()}/hesabim/siparislerim/${encodeURIComponent(orderNumber)}`;
  const html = buildEmail({
    subject,
    preheader: `${orderNumber} numaralı siparişiniz iptal edildi.`,
    heading: "Siparişiniz iptal edildi.",
    bodyHtml: `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 27px; color: #1c201b;">${escapeHtml(orderNumber)} numaralı siparişiniz iptal edildi. ${escapeHtml(paymentLine)}</td>
</tr>`,
    cta: { label: "Siparişi görüntüle", url: orderUrl },
    footerReason: `Bu e-posta, ${escapeHtml(orderNumber)} numaralı siparişiniz iptal edildiği için gönderildi.`,
  });
  const text = [
    "Siparişiniz iptal edildi.",
    "",
    `${orderNumber} numaralı siparişiniz iptal edildi. ${paymentLine}`,
    "",
    `Siparişi görüntüle: ${orderUrl}`,
    "",
    "Kabia · kabiaekolojik.com",
    `Bu e-posta, ${orderNumber} numaralı siparişiniz iptal edildiği için gönderildi.`,
  ].join("\n");
  return { subject, html, text };
}
