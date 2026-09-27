"use client";

import { useId, useState } from "react";
import { carrierTrackingUrl, hasTracking } from "@/lib/tracking";

/**
 * Müşteri kargo bilgisi. Yönetici kargo firması ya da takip numarası
 * girmişse gösterir; ikisi de yoksa hiçbir şey çizmez (yer tutucu metin
 * yok). Takip bağlantısı yalnızca resmi sitesinde GET biçimi doğrulanmış
 * taşıyıcılarda çıkar — bugün hiçbiri doğrulanmadığı için bağlantı yok.
 */
export function OrderTrackingSection({
  carrier,
  trackingNumber,
}: {
  carrier: string | null;
  trackingNumber: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const statusId = useId();
  if (!hasTracking(carrier, trackingNumber)) return null;
  const trackingUrl = carrierTrackingUrl(carrier, trackingNumber);

  const copyNumber = async () => {
    if (!trackingNumber) return;
    try {
      await navigator.clipboard.writeText(trackingNumber);
    } catch {
      // Panodaki engelde sessiz kal: eski yola düş.
      const area = document.createElement("textarea");
      area.value = trackingNumber;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
  };

  return (
    <section aria-labelledby="order-tracking" className="mt-14">
      <h2 id="order-tracking" className="label text-olive">
        Kargo bilgisi
      </h2>
      <div className="mt-4 space-y-3 border-t border-ink/10 pt-5 text-sm leading-relaxed text-ink/70">
        {carrier && (
          <p>
            <span className="text-ink/50">Kargo firması: </span>
            <span className="text-ink">{carrier}</span>
          </p>
        )}
        {trackingNumber && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              <span className="text-ink/50">Takip numarası: </span>
              <span className="figure text-ink">{trackingNumber}</span>
            </span>
            <button
              type="button"
              onClick={() => void copyNumber()}
              aria-describedby={statusId}
              className="min-h-11 text-sm text-brand transition-colors duration-300 hover:text-forest"
            >
              {copied ? "Kopyalandı ✓" : "Kopyala"}
            </button>
          </p>
        )}
        {trackingUrl && (
          <p>
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand transition-colors duration-300 hover:text-forest"
            >
              Kargoyu takip et ↗
            </a>
          </p>
        )}
        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {copied ? "Takip numarası kopyalandı." : ""}
        </p>
      </div>
    </section>
  );
}

/** Sipariş listesi için tek satırlık özet; bilgi yoksa hiçbir şey çizmez. */
export function OrderTrackingLine({
  carrier,
  trackingNumber,
}: {
  carrier: string | null;
  trackingNumber: string | null;
}) {
  if (!hasTracking(carrier, trackingNumber)) return null;
  const parts = [carrier, trackingNumber ? `Takip no: ${trackingNumber}` : null].filter(
    (part): part is string => !!part,
  );
  return <span className="mt-1 block text-xs text-ink/50">{parts.join(" · ")}</span>;
}
