"use client";

import type { PaymentData } from "./types";

export function detectNetwork(
  digits: string,
): "visa" | "mastercard" | "troy" | null {
  if (!digits) return null;
  const first = digits[0];
  if (first === "4") return "visa";
  if (first === "5") return "mastercard";
  if (first === "9") return "troy";
  return null;
}

const NETWORK_LABELS = {
  visa: "VISA",
  mastercard: "Mastercard",
  troy: "troy",
} as const;

/** Card face rendered on the brand's forest surface rather than a glossy chrome
 *  gradient, so it belongs to the same world as the rest of the checkout. */
export function CardPreview({
  payment,
  flipped,
}: {
  payment: PaymentData;
  flipped: boolean;
}) {
  const digits = payment.cardNumber.replace(/\s/g, "");
  const network = detectNetwork(digits);
  const displayNumber = (payment.cardNumber || "•••• •••• •••• ••••")
    .padEnd(19, "•")
    .slice(0, 19);

  return (
    <div
      className="on-dark mx-auto w-full max-w-[340px]"
      style={{ perspective: "1200px" }}
      aria-hidden="true"
    >
      <div
        className="relative aspect-[1.586] w-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col justify-between bg-forest p-6 text-cream"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-start justify-between">
            <span className="h-7 w-10 bg-cream/25" />
            {network ? (
              <span className="font-serif text-lg italic text-cream/90">
                {NETWORK_LABELS[network]}
              </span>
            ) : (
              <span className="h-6" />
            )}
          </div>
          <p className="figure text-lg tracking-[0.14em] text-cream">
            {displayNumber}
          </p>
          <div className="flex items-end justify-between gap-4">
            <span className="min-w-0 flex-1">
              <span className="label block text-cream/45">Kart sahibi</span>
              <span className="mt-1 block truncate text-sm text-cream">
                {payment.cardName || "—"}
              </span>
            </span>
            <span>
              <span className="label block text-cream/45">Son kullanma</span>
              <span className="figure mt-1 block text-sm text-cream">
                {payment.expiry || "MM/YY"}
              </span>
            </span>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col bg-forest"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <span className="mt-6 block h-10 w-full bg-ink/70" />
          <div className="mt-6 px-6">
            <span className="label block text-cream/45">CVV</span>
            <span className="figure mt-1 block bg-cream/90 px-3 py-1.5 text-right text-sm text-forest">
              {payment.cvv || "•••"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
