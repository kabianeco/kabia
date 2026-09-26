/**
 * Group B · Başarıyla kayıt — welcome, sent after the email is confirmed.
 *
 * Trigger (proposed, not wired): first sign-in with a freshly confirmed
 * address. Takes only a display name; everything user-supplied is escaped.
 */
import { buildEmail, escapeHtml, siteUrl, type EmailResult } from "./layout";

export interface WelcomeInput {
  /** Customer's full name. Falls back to a nameless greeting. */
  name?: string;
}

export function welcomeEmail(input: WelcomeInput): EmailResult {
  const subject = "Hoş geldiniz";
  const name = (input.name ?? "").trim();
  const heading = name === "" ? "Hoş geldiniz." : `Hoş geldiniz, ${escapeHtml(name)}.`;
  const storeUrl = `${siteUrl()}/magaza`;
  const html = buildEmail({
    subject,
    preheader: "E-posta adresiniz doğrulandı.",
    heading,
    bodyHtml: `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 27px; color: #1c201b;">E-posta adresiniz doğrulandı. Siparişlerinizi hesabınızdan takip edebilir, adreslerinizi bir kez kaydedebilirsiniz.</td>
</tr>`,
    cta: { label: "Mağazaya göz at", url: storeUrl },
    footerReason: "Bu e-posta, Kabia hesabınız doğrulandığı için gönderildi.",
  });
  const text = [
    name === "" ? "Hoş geldiniz." : `Hoş geldiniz, ${name}.`,
    "",
    "E-posta adresiniz doğrulandı. Siparişlerinizi hesabınızdan takip edebilir, adreslerinizi bir kez kaydedebilirsiniz.",
    "",
    `Mağazaya göz at: ${storeUrl}`,
    "",
    "Kabia · kabiaekolojik.com",
    "Bu e-posta, Kabia hesabınız doğrulandığı için gönderildi.",
  ].join("\n");
  return { subject, html, text };
}
