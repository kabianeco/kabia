/**
 * Group B · Sipariş tamamlandı — order delivered.
 *
 * Trigger (proposed, not wired): an admin moves the order to
 * `teslim_edildi` (`updateOrderStatusAction`).
 */
import { buildEmail, escapeHtml, siteUrl, type EmailResult } from "./layout";

export interface OrderDeliveredInput {
  orderNumber: string;
}

export function orderDeliveredEmail(input: OrderDeliveredInput): EmailResult {
  const orderNumber = input.orderNumber.trim();
  const subject = `Siparişiniz teslim edildi (${orderNumber})`;
  const orderUrl = `${siteUrl()}/hesabim/siparislerim/${encodeURIComponent(orderNumber)}`;
  const html = buildEmail({
    subject,
    preheader: `${orderNumber} numaralı siparişiniz teslim edildi.`,
    heading: "Teslim edildi.",
    bodyHtml: `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 27px; color: #1c201b;">${escapeHtml(orderNumber)} numaralı siparişiniz teslim edildi. Afiyet olsun.</td>
</tr>`,
    cta: { label: "Siparişi görüntüle", url: orderUrl },
    footerReason: `Bu e-posta, ${escapeHtml(orderNumber)} numaralı siparişiniz teslim edildiği için gönderildi.`,
  });
  const text = [
    "Teslim edildi.",
    "",
    `${orderNumber} numaralı siparişiniz teslim edildi. Afiyet olsun.`,
    "",
    `Siparişi görüntüle: ${orderUrl}`,
    "",
    "Kabia · kabiaekolojik.com",
    `Bu e-posta, ${orderNumber} numaralı siparişiniz teslim edildiği için gönderildi.`,
  ].join("\n");
  return { subject, html, text };
}
