/**
 * Group B · Kargo bildirimi — order shipped.
 *
 * Trigger (proposed, not wired): an admin sets tracking info
 * (`updateTrackingAction`) or moves the order to `kargoda`.
 *
 * Tracking link: pass `trackingUrl` explicitly when known. The
 * `carrierTrackingUrl` helper below intentionally returns null for every
 * carrier — no Turkish carrier URL pattern has been verified against the
 * carrier's own site, and a guessed pattern would send customers to a dead
 * page. Verify a pattern on the carrier's site first, then add it here.
 */
import { buildEmail, escapeHtml, siteUrl, type EmailResult } from "./layout";

export interface OrderShippedInput {
  orderNumber: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  /** Verified carrier tracking page URL, when one is known. */
  trackingUrl?: string | null;
}

/** Verified per-carrier tracking URL patterns. None verified yet. */
export function carrierTrackingUrl(
  _carrier: string | null | undefined,
  _trackingNumber: string | null | undefined,
): string | null {
  return null;
}

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function orderShippedEmail(input: OrderShippedInput): EmailResult {
  const orderNumber = input.orderNumber.trim();
  const subject = `Siparişiniz kargoda (${orderNumber})`;
  const carrier = (input.carrier ?? "").trim();
  const trackingNumber = (input.trackingNumber ?? "").trim();
  const trackingUrl = (input.trackingUrl ?? "").trim() || null;
  const orderUrl = `${siteUrl()}/hesabim/siparislerim/${encodeURIComponent(orderNumber)}`;

  const detailLine =
    carrier !== "" && trackingNumber !== ""
      ? `${escapeHtml(carrier)} · Takip no: ${escapeHtml(trackingNumber)}`
      : carrier !== ""
        ? escapeHtml(carrier)
        : trackingNumber !== ""
          ? `Takip no: ${escapeHtml(trackingNumber)}`
          : "";
  const detailRow =
    detailLine === ""
      ? ""
      : `<tr>
<td align="center" class="em-p" style="padding: 20px 40px 0 40px; font-family: ${SANS}; font-size: 15px; line-height: 24px; color: #1c201b;">${detailLine}</td>
</tr>`;
  const trackingRow =
    trackingUrl && trackingNumber !== ""
      ? `<tr>
<td align="center" style="padding: 12px 40px 0 40px; font-family: ${SANS}; font-size: 14px; line-height: 22px; color: #1c201b;" class="em-p"><a href="${trackingUrl}" style="color: #147b4b; text-decoration: underline;">Kargoyu takip edin</a></td>
</tr>`
      : "";
  const html = buildEmail({
    subject,
    preheader: `${orderNumber} numaralı siparişiniz kargoya verildi.`,
    heading: "Siparişiniz kargoda.",
    bodyHtml:
      `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: ${SANS}; font-size: 16px; line-height: 27px; color: #1c201b;">${escapeHtml(orderNumber)} numaralı siparişiniz kargoya verildi.</td>
</tr>` + detailRow + trackingRow,
    cta: { label: "Siparişi görüntüle", url: orderUrl },
    footerReason: `Bu e-posta, ${escapeHtml(orderNumber)} numaralı siparişiniz kargoya verildiği için gönderildi.`,
  });
  const textLines = [
    "Siparişiniz kargoda.",
    "",
    `${orderNumber} numaralı siparişiniz kargoya verildi.`,
  ];
  if (carrier !== "") textLines.push(`Kargo: ${carrier}`);
  if (trackingNumber !== "") textLines.push(`Takip no: ${trackingNumber}`);
  if (trackingUrl) textLines.push(`Kargo takibi: ${trackingUrl}`);
  textLines.push("", `Siparişi görüntüle: ${orderUrl}`, "", "Kabia · kabiaekolojik.com");
  textLines.push(
    `Bu e-posta, ${orderNumber} numaralı siparişiniz kargoya verildiği için gönderildi.`,
  );
  return { subject, html, text: textLines.join("\n") };
}
