"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/cart-context";
import { formatTL } from "@/lib/products";
import { EASE } from "@/lib/motion";

export function shippingFor(subtotal: number) {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST;
}

/**
 * The one totals panel, shared by the cart and the checkout review step, so the
 * shipping rule is stated in a single place.
 */
export function OrderSummary({
  subtotal,
  children,
  note,
}: {
  subtotal: number;
  /** Primary action rendered under the totals. */
  children?: ReactNode;
  note?: ReactNode;
}) {
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="bg-paper px-6 py-7 md:px-7">
      <h2 className="label text-olive">Özet</h2>

      <div className="mt-6">
        {remaining > 0 ? (
          <>
            <p className="text-xs leading-relaxed text-ink/60">
              {formatTL(FREE_SHIPPING_THRESHOLD)} üzeri kargo ücretsiz.{" "}
              <span className="text-ink">{formatTL(remaining)}</span> daha ekleyin.
            </p>
            <span className="mt-2 block h-1 overflow-hidden bg-ink/10">
              <motion.span
                className="block h-full bg-brand"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: EASE }}
              />
            </span>
          </>
        ) : (
          <p className="text-xs text-brand">Kargo ücretsiz.</p>
        )}
      </div>

      <dl className="mt-7 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/60">Ara toplam</dt>
          <dd className="figure text-ink">{formatTL(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/60">Kargo</dt>
          <dd className="figure text-ink">
            {shipping === 0 ? "Ücretsiz" : formatTL(shipping)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
          <dt className="text-base text-ink">Toplam</dt>
          <dd className="figure text-xl text-ink">{formatTL(total)}</dd>
        </div>
      </dl>

      {children && <div className="mt-7">{children}</div>}
      {note && <p className="mt-4 text-xs leading-relaxed text-ink/50">{note}</p>}
    </div>
  );
}
