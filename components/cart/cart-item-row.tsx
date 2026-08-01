"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { useCart, type CartItem } from "@/lib/cart-context";
import { formatTL } from "@/lib/products";
import { routes } from "@/lib/site";

/** One line in the cart ledger: thumbnail, name, stepper, line total. */
export function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      className="grid grid-cols-[5rem_1fr] items-start gap-5 border-b border-ink/10 py-6 sm:grid-cols-[6rem_1fr_auto] sm:items-center"
    >
      <Link
        href={routes.product(item.slug)}
        tabIndex={-1}
        aria-hidden="true"
        className="relative aspect-square overflow-hidden rounded-media bg-paper"
      >
        <Image
          src={item.image}
          alt=""
          fill
          sizes="96px"
          className="object-cover"
        />
      </Link>

      <div className="min-w-0">
        <h3 className="text-base leading-snug">
          <Link
            href={routes.product(item.slug)}
            className="transition-colors duration-300 hover:text-brand"
          >
            {item.name}
          </Link>
        </h3>
        <p className="label mt-1 text-olive">{item.variant}</p>

        <div className="mt-4 flex items-center gap-4">
          <div className="inline-flex items-center border border-ink/20">
            <button
              type="button"
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:text-brand"
              aria-label={`${item.name} adedini azalt`}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <output className="figure w-9 text-center text-sm">
              {item.quantity}
            </output>
            <button
              type="button"
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              disabled={item.quantity >= 99}
              className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:text-brand disabled:opacity-35"
              aria-label={`${item.name} adedini artır`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="flex min-h-11 items-center gap-1.5 text-xs text-ink/45 transition-colors hover:text-clay"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Kaldır<span className="sr-only"> — {item.name}</span>
            </span>
          </button>
        </div>
      </div>

      <p className="figure col-start-2 text-base text-ink sm:col-start-auto sm:text-right">
        {formatTL(item.price * item.quantity)}
      </p>
    </motion.li>
  );
}
