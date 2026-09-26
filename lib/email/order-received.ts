/**
 * Group B · Alışveriş bildirimi — order received.
 *
 * Trigger (proposed, not wired): the `create_order` RPC returns ok in the
 * checkout confirmation handler. Send to `orders.email`.
 */
import {
  buildEmail,
  escapeHtml,
  formatTRY,
  siteUrl,
  type EmailResult,
} from "./layout";
import { addressLines, type OrderSummaryInput } from "./order-types";

export interface OrderReceivedInput {
  order: OrderSummaryInput;
  /** First name for the greeting line. Optional. */
  customerName?: string;
}

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function itemsTable(order: OrderSummaryInput): string {
  const rows = order.items
    .map((item) => {
      const line = item.unitPrice * item.quantity;
      return `<tr>
<td style="padding: 12px 0; font-family: ${SANS}; font-size: 15px; line-height: 22px; color: #1c201b;" class="em-p">${escapeHtml(item.name)}<br><span class="em-muted" style="font-size: 13px; color: #5a6552;">${escapeHtml(item.variant)} · ${item.quantity} adet</span></td>
<td align="right" style="padding: 12px 0 12px 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 22px; color: #1c201b; white-space: nowrap;" class="em-p">${formatTRY(line)}</td>
</tr>`;
    })
    .join("");
  const shipping =
    order.shippingCost === 0 ? "Ücretsiz" : formatTRY(order.shippingCost);
  return `<tr>
<td style="padding: 24px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e2dac6;">
${rows}
<tr>
<td class="em-muted" style="padding: 16px 0 0 0; font-family: ${SANS}; font-size: 14px; color: #5a6552; border-top: 1px solid #e2dac6;">Ara toplam</td>
<td align="right" class="em-p" style="padding: 16px 0 0 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #1c201b; border-top: 1px solid #e2dac6; white-space: nowrap;">${formatTRY(order.subtotal)}</td>
</tr>
<tr>
<td class="em-muted" style="padding: 6px 0 0 0; font-family: ${SANS}; font-size: 14px; color: #5a6552;">Kargo</td>
<td align="right" class="em-p" style="padding: 6px 0 0 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #1c201b; white-space: nowrap;">${shipping}</td>
</tr>
<tr>
<td style="padding: 12px 0 0 0; font-family: ${SANS}; font-size: 16px; color: #1c201b; border-top: 1px solid #e2dac6;" class="em-p">Toplam</td>
<td align="right" style="padding: 12px 0 0 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; color: #1c201b; border-top: 1px solid #e2dac6; white-space: nowrap;" class="em-p">${formatTRY(order.total)}</td>
</tr>
</table>
</td>
</tr>`;
}

export function orderReceivedEmail(input: OrderReceivedInput): EmailResult {
  const { order } = input;
  const orderNumber = order.orderNumber.trim();
  const subject = `Siparişiniz alındı (${orderNumber})`;
  const firstName = (input.customerName ?? "").trim();
  const greeting =
    firstName === ""
      ? "Siparişinizi aldık. Hazırlamaya başlıyoruz, durum değiştikçe haber vereceğiz."
      : `Teşekkürler ${escapeHtml(firstName)}. Siparişinizi aldık, hazırlamaya başlıyoruz. Durum değiştikçe haber vereceğiz.`;
  const orderUrl = `${siteUrl()}/hesabim/siparislerim/${encodeURIComponent(orderNumber)}`;
  const address = addressLines(order.address).join("<br>");
  const html = buildEmail({
    subject,
    preheader: `${orderNumber} numaralı siparişiniz alındı.`,
    heading: "Siparişiniz alındı.",
    bodyHtml:
      `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: ${SANS}; font-size: 16px; line-height: 27px; color: #1c201b;">${greeting}</td>
</tr>` +
      itemsTable(order) +
      `<tr>
<td style="padding: 28px 40px 0 40px;">
<p class="em-muted" style="margin: 0; font-family: ${SANS}; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #5a6552;">Teslimat adresi</p>
<p class="em-p" style="margin: 8px 0 0 0; font-family: ${SANS}; font-size: 14px; line-height: 22px; color: #1c201b;">${address}</p>
</td>
</tr>`,
    cta: { label: "Siparişi görüntüle", url: orderUrl },
    footerReason: `Bu e-posta, ${escapeHtml(orderNumber)} numaralı siparişi oluşturduğunuz için gönderildi.`,
  });
  const itemLines = order.items.map(
    (i) =>
      `• ${i.name} (${i.variant}) · ${i.quantity} adet — ${formatTRY(i.unitPrice * i.quantity)}`,
  );
  const text = [
    "Siparişiniz alındı.",
    "",
    firstName === ""
      ? "Siparişinizi aldık. Hazırlamaya başlıyoruz, durum değiştikçe haber vereceğiz."
      : `Teşekkürler ${firstName}. Siparişinizi aldık, hazırlamaya başlıyoruz. Durum değiştikçe haber vereceğiz.`,
    "",
    ...itemLines,
    `Ara toplam: ${formatTRY(order.subtotal)}`,
    `Kargo: ${order.shippingCost === 0 ? "Ücretsiz" : formatTRY(order.shippingCost)}`,
    `Toplam: ${formatTRY(order.total)}`,
    "",
    "Teslimat adresi:",
    order.address.fullName,
    order.address.line1,
    ...(order.address.line2 ?? "").trim() !== "" ? [order.address.line2!.trim()] : [],
    `${order.address.district} / ${order.address.city} ${order.address.postalCode}`,
    "",
    `Siparişi görüntüle: ${orderUrl}`,
    "",
    "Kabia · kabiaekolojik.com",
    `Bu e-posta, ${orderNumber} numaralı siparişi oluşturduğunuz için gönderildi.`,
  ].join("\n");
  return { subject, html, text };
}
