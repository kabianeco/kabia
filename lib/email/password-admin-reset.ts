/**
 * Group B · Yönetici parola sıfırlama bildirimi — admin customer password reset.
 *
 * Trigger: bir süper yönetici müşteri şifresini doğrudan belirlediğinde
 * (3b). Parolanın kendisi bu e-postada ASLA yer almaz; müşteri giriş
 * sayfasına yönlendirilir ve ilk girişte şifresini değiştirmesi istenir.
 * Kullanıcı girdisi (ad) her zaman kaçışlanır.
 */
import { buildEmail, escapeHtml, siteUrl, type EmailResult } from "./layout";

export interface AdminPasswordResetInput {
  /** Customer's full name. Falls back to a nameless greeting. */
  name?: string;
}

export function adminPasswordResetEmail(input: AdminPasswordResetInput): EmailResult {
  const subject = "Hesap şifreniz güncellendi";
  const name = (input.name ?? "").trim();
  const greeting = name === "" ? "Merhaba." : `Merhaba, ${escapeHtml(name)}.`;
  const loginUrl = `${siteUrl()}/giris`;
  const securityUrl = `${siteUrl()}/hesabim/guvenlik`;
  const html = buildEmail({
    subject,
    preheader: "Hesap şifreniz bir yönetici tarafından güncellendi.",
    heading: greeting,
    bodyHtml: `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 27px; color: #1c201b;">Talebiniz üzerine hesap şifreniz bir yönetici tarafından güncellendi. Güvenliğiniz için giriş yaptıktan sonra <a href="${securityUrl}" style="color: #147b4b;">hesap güvenliğinizden</a> yeni bir şifre belirleyin.</td>
</tr>
<tr>
<td align="center" class="em-muted" style="padding: 20px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 22px; color: #5a6552;">Bu işlemi siz istemediyseniz hemen bizimle iletişime geçin.</td>
</tr>`,
    cta: { label: "Giriş yap", url: loginUrl },
    footerReason: "Bu e-posta, hesap şifreniz bir yönetici tarafından güncellendiği için gönderildi.",
  });
  const text = [
    name === "" ? "Merhaba." : `Merhaba, ${name}.`,
    "",
    "Talebiniz üzerine hesap şifreniz bir yönetici tarafından güncellendi.",
    "Güvenliğiniz için giriş yaptıktan sonra hesap güvenliğinizden yeni bir şifre belirleyin:",
    securityUrl,
    "",
    "Bu işlemi siz istemediyseniz hemen bizimle iletişime geçin.",
    "",
    `Giriş yap: ${loginUrl}`,
    "",
    "Kabia · kabiaekolojik.com",
    "Bu e-posta, hesap şifreniz bir yönetici tarafından güncellendiği için gönderildi.",
  ].join("\n");
  return { subject, html, text };
}
