"use client";

import { usePathname } from "next/navigation";
import { isAccountSurface, whatsappHref } from "@/lib/site";

/**
 * Her sayfada sağ altta duran WhatsApp hattı. Yeşil daire + ahize,
 * hazır mesajla açılır; saf hizada bir linktir.
 *
 * Giriş, kayıt, e-posta/şifre adımları ve hesap sayfaları baştan sona
 * formdur: dar ekranda sabit bir düğme alan ve butonların üstüne biner. Bu
 * rotalarda yalnızca içeriğin yanında boş kenar kalan geniş ekranlarda (xl)
 * gösterilir; WhatsApp bağlantısı alt bilgide her zaman durur. Diğer bütün
 * sayfalarda davranış aynıdır.
 */
export function WhatsAppFloat() {
  const accountSurface = isAccountSurface(usePathname());
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp'tan yazın"
      title="WhatsApp'tan yazın"
      style={{ backgroundColor: "#25d366" }}
      className={`fixed bottom-5 right-5 z-40 ${accountSurface ? "hidden xl:grid" : "grid"} h-14 w-14 place-items-center rounded-full text-white shadow-lg transition-transform duration-300 hover:scale-105`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    </a>
  );
}
