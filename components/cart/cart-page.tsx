"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { CartItemRow } from "./cart-item-row";
import { AddressSelector } from "./address-selector";
import { OrderSummary } from "./order-summary";
import { isContactValid } from "./validation";
import { useCart } from "@/lib/cart-context";
import { useCheckout } from "@/lib/checkout-context";
import { routes } from "@/lib/site";

function CartSkeleton() {
  return (
    <div className="wrap page-top pb-24" aria-busy="true" aria-live="polite">
      <span className="sr-only">Sepet yükleniyor</span>
      <div className="h-10 w-56 animate-pulse bg-paper" />
      <ul className="mt-12 border-t border-ink/10">
        {[0, 1].map((i) => (
          <li
            key={i}
            className="grid grid-cols-[6rem_1fr] gap-5 border-b border-ink/10 py-6"
          >
            <div className="aspect-square animate-pulse rounded-media bg-paper" />
            <div className="space-y-3 py-1">
              <div className="h-4 w-2/3 animate-pulse bg-paper" />
              <div className="h-3 w-20 animate-pulse bg-paper" />
              <div className="h-11 w-36 animate-pulse bg-paper" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CartPage() {
  const router = useRouter();
  const { items, subtotal, hydrated: cartHydrated } = useCart();
  const {
    fullName,
    email,
    phone,
    setContact,
    selectedAddressId,
    hydrated: checkoutHydrated,
  } = useCheckout();

  // Cart contents come from localStorage or Supabase after mount, so the first
  // paint shows a skeleton rather than an incorrect empty state.
  if (!cartHydrated || !checkoutHydrated) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <div className="wrap page-top flex min-h-[55vh] flex-col items-start pb-24">
        <p className="label text-olive">Sepet</p>
        <h1 className="mt-6 text-4xl leading-[1.1] tracking-tight md:text-5xl">
          Sepetiniz <em className="font-serif italic text-brand">boş</em>.
        </h1>
        <p className="mt-6 max-w-sm text-base leading-relaxed text-ink/60">
          Bu sezonun bademleri mağazada. Bir ürün ekleyince burada görünür.
        </p>
        <ButtonLink href={routes.store} className="mt-9">
          Mağazaya git
        </ButtonLink>
      </div>
    );
  }

  const contactValid = isContactValid({ fullName, email, phone });
  const canContinue = contactValid && !!selectedAddressId;

  return (
    <div className="wrap page-top pb-24 md:pb-32">
      <p className="label text-olive">Sepet</p>
      <h1 className="mt-6 text-4xl leading-[1.1] tracking-tight md:text-5xl">
        Sepetim{" "}
        <span className="figure text-shell">
          ({items.length})
        </span>
      </h1>

      <div className="mt-14 grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <ul className="border-t border-ink/10">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <CartItemRow key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </ul>

          <section aria-labelledby="contact-heading" className="mt-16">
            <h2 id="contact-heading" className="text-2xl tracking-tight">
              İletişim bilgileri
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <TextField
                label="Ad soyad"
                value={fullName}
                onChange={(e) => setContact({ fullName: e.target.value })}
                autoComplete="name"
                wrapperClassName="sm:col-span-2"
              />
              <TextField
                label="E-posta"
                type="email"
                value={email}
                onChange={(e) => setContact({ email: e.target.value })}
                autoComplete="email"
              />
              <TextField
                label="Telefon"
                type="tel"
                placeholder="05XX XXX XX XX"
                value={phone}
                onChange={(e) => setContact({ phone: e.target.value })}
                autoComplete="tel"
              />
            </div>
          </section>

          <section aria-labelledby="address-heading" className="mt-16">
            <h2 id="address-heading" className="text-2xl tracking-tight">
              Teslimat adresi
            </h2>
            <div className="mt-8">
              <AddressSelector />
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 lg:col-start-9 lg:sticky lg:top-28">
          <OrderSummary
            subtotal={subtotal}
            note={
              !canContinue
                ? !contactValid
                  ? "Devam etmek için ad soyad, e-posta ve telefon bilgilerinizi girin."
                  : "Devam etmek için bir teslimat adresi seçin."
                : undefined
            }
          >
            <Button
              className="w-full"
              size="lg"
              disabled={!canContinue}
              onClick={() => router.push(routes.checkout)}
            >
              Ödemeye geç
            </Button>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
