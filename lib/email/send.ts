/**
 * Group B gönderici — Resend API (HTTP, SDK yok, yeni bağımlılık yok).
 *
 * Yapılandırma (sunucu ortam değişkenleri):
 *   RESEND_API_KEY — zorunlu. Eksikse gönderim denenmez; çağıran, kullanıcıya
 *     gösterilmeyen bir yapılandırma hatası alır (sahibi rapora bakmalı).
 *   RESEND_FROM    — opsiyonel. Doğrulanmış gönderici adresi;
 *     örn. "Kabia <noreply@kabiaekolojik.com>". Yoksa Resend'in test adresi
 *     kullanılır (yalnızca hesap sahibine gider).
 *
 * Parola, token ya da gizli bilgi bu modüle asla girmez — yalnızca hazır
 * konu + html + text alır ve iletir. Yanıtın tamamı çağrana döner; log'a
 * gövde yazılmaz.
 */

import "server-only";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "missing_key" | "missing_from" | "rejected"; message: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailSenderStatus(): { key: boolean; from: string | null } {
  return {
    key: Boolean(process.env.RESEND_API_KEY?.trim()),
    from: process.env.RESEND_FROM?.trim() || null,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      reason: "missing_key",
      message:
        "E-posta gönderilemedi: RESEND_API_KEY yapılandırılmamış. Sunucu ortamına RESEND_API_KEY ekleyin.",
    };
  }
  // Gönderici doğrulanmış bir alan adı olmalı; yoksa Resend test adresi.
  const from = process.env.RESEND_FROM?.trim() || "onboarding@resend.dev";
  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      reason: "rejected",
      message: `E-posta gönderilemedi: ${error instanceof Error ? error.message : "bağlantı hatası"}`,
    };
  }
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { message?: string; name?: string };
      detail = data.message ?? data.name ?? "";
    } catch {
      detail = "";
    }
    return {
      ok: false,
      reason: "rejected",
      message: `E-posta gönderilemedi (${response.status}).${detail ? ` ${detail}` : ""}`,
    };
  }
  try {
    const data = (await response.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch {
    return { ok: true, id: "" };
  }
}
