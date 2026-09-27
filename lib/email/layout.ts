/**
 * Kabia transactional email kit (Group B — sent by the app itself via Resend).
 *
 * Plain TypeScript only: no React Email, no Resend SDK, no imports at all, so
 * these builders run anywhere (server action, route handler, script) without
 * dragging catalogue or Supabase code along.
 *
 * Every email shares one layout: green Kabia logo on top, a short plain
 * Turkish message, one green action button, a quiet footer, lots of
 * whitespace. Table-based, inline CSS, ~600px, web-safe fonts.
 *
 * Money formatting mirrors `formatTL` in lib/products.ts exactly
 * (`₺1.234,56` style with comma decimals); it is duplicated here rather than
 * imported so this module stays dependency-free.
 */

import { siteUrl as configuredSiteUrl } from "@/lib/site";

export interface EmailResult {
  subject: string;
  html: string;
  text: string;
}

export interface EmailCta {
  label: string;
  url: string;
}

/** Escape every user-supplied value before it touches the HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same output as lib/products.ts `formatTL`. */
export function formatTRY(amount: number): string {
  return `₺${amount.toFixed(2).replace(".", ",")}`;
}

/**
 * Absolute base for every link and image in Group B emails.
 * The single configured site URL from lib/site (one env var to switch);
 * a missing env never produces a relative URL in an inbox.
 */
export function siteUrl(): string {
  return configuredSiteUrl;
}

/** Host display for footers, derived from the same configured URL. */
export function siteHost(): string {
  try {
    return new URL(configuredSiteUrl).hostname;
  } catch {
    return "kabiaekolojik.com";
  }
}

const LOGO_PATH = "/email/kabia-logo@2x.png";

export function logoUrl(): string {
  return `${siteUrl()}${LOGO_PATH}`;
}

const INK = "#1c201b";
const MUTED = "#5a6552";
const PAPER = "#f4f1e8";
const CARD = "#ffffff";
const BRAND = "#147b4b";
const ON_BRAND = "#f4f1e8";
const HAIRLINE = "#e2dac6";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export interface LayoutInput {
  subject: string;
  /** Short preview line shown in the inbox list, hidden in the body. */
  preheader: string;
  heading: string;
  /** Already-escaped inner rows (paragraphs, tables). */
  bodyHtml: string;
  cta: EmailCta | null;
  /** One line stating why the recipient got this email. */
  footerReason: string;
  /** Absolute logo URL. Defaults to logoUrl() — pass explicitly in tests. */
  logoSrc?: string;
}

/** Shared document shell. `subject` and `preheader` are plain text and are
 * escaped here. `heading` and `bodyHtml` are HTML — callers escape every
 * user-supplied value before composing them (see `escapeHtml`). */
export function buildEmail(input: LayoutInput): string {
  const logo = input.logoSrc ?? logoUrl();
  const cta = input.cta
    ? `<tr>
        <td align="center" style="padding: 8px 40px 0 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="${BRAND}" style="border-radius: 999px; padding: 15px 40px;">
                <a href="${input.cta.url}" style="color: ${ON_BRAND}; font-family: ${SANS}; font-size: 16px; line-height: 24px; text-decoration: none; display: inline-block;">${input.cta.label}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.subject)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .em-body { background-color: #12150f !important; }
  .em-card { background-color: #1c2019 !important; }
  .em-h { color: #ece7d9 !important; }
  .em-p { color: #d9d3c3 !important; }
  .em-muted { color: #9ba393 !important; }
  .em-hair { border-color: #2c332a !important; }
  .em-btn { background-color: #1e7a4e !important; }
}
</style>
</head>
<body class="em-body" style="margin: 0; padding: 0; background-color: ${PAPER};">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${PAPER};">
<tr>
<td align="center" style="padding: 48px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="em-card" style="width: 100%; max-width: 600px; background-color: ${CARD}; border: 1px solid ${HAIRLINE}; border-radius: 10px;">
<tr>
<td align="center" style="padding: 48px 40px 0 40px;">
<img src="${logo}" width="168" alt="Kabia" style="display: block; border: 0; width: 168px; height: auto;">
</td>
</tr>
<tr>
<td align="center" style="padding: 32px 40px 0 40px;">
<h1 class="em-h" style="margin: 0; font-family: ${SERIF}; font-size: 28px; line-height: 36px; font-weight: normal; color: ${INK};">${input.heading}</h1>
</td>
</tr>
${input.bodyHtml}
${cta}
<tr>
<td style="padding: 40px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="em-hair" style="border-top: 1px solid ${HAIRLINE}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="padding: 24px 40px 48px 40px;">
<p class="em-muted" style="margin: 0; font-family: ${SANS}; font-size: 13px; line-height: 20px; color: ${MUTED};">Kabia · <a href="${siteUrl()}" style="color: ${MUTED}; text-decoration: underline;">${siteHost()}</a></p>
<p class="em-muted" style="margin: 8px 0 0 0; font-family: ${SANS}; font-size: 12px; line-height: 18px; color: ${MUTED};">${input.footerReason}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

/** Centered body paragraph, already escaped. */
export function paragraph(text: string): string {
  return `<tr>
<td align="center" class="em-p" style="padding: 16px 40px 0 40px; font-family: ${SANS}; font-size: 16px; line-height: 27px; color: ${INK};">${text}</td>
</tr>`;
}

/** Small muted note under the button (e.g. tracking number). */
export function note(text: string): string {
  return `<tr>
<td align="center" class="em-muted" style="padding: 20px 40px 0 40px; font-family: ${SANS}; font-size: 14px; line-height: 22px; color: ${MUTED};">${text}</td>
</tr>`;
}

/** Exported for the text-version builders and tests. */
export const EMAIL_COLORS = { INK, MUTED, PAPER, CARD, BRAND, ON_BRAND, HAIRLINE };
