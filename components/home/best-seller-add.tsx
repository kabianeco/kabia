"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart, type CartItem } from "@/lib/cart-context";
import { routes } from "@/lib/site";

/**
 * The best-seller card's only interactive part. The card itself renders on the
 * server; this island receives just the cart line it would add (null when no
 * variant is in stock), so the rest of the product never ships to the client.
 */
export function BestSellerAdd({
  line,
}: {
  line: Omit<CartItem, "quantity"> | null;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const available = line !== null;

  const handleAdd = async () => {
    if (!line) return;
    // The write must complete (or fail loudly) before the toast offers navigation.
    const accepted = await addItem({ ...line, quantity: 1 });
    if (!accepted) {
      toast.error("Sepete eklenemedi. Lütfen tekrar deneyin.");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    toast.success(`Sepete eklendi — ${line.name}`, {
      action: {
        label: "Sepete git",
        onClick: () => router.push(routes.cart),
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={!available}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-theme-button border border-ink/20 px-5 text-sm transition-colors duration-300 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-ink/20 disabled:hover:text-ink"
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      {added ? "Sepette" : available ? "Sepete ekle" : "Stokta yok"}
    </button>
  );
}
