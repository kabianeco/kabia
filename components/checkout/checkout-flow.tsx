"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  useCart,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  type CartItem,
} from "@/lib/cart-context";
import { useCheckout, type SavedAddress } from "@/lib/checkout-context";
import { useOrders } from "@/lib/orders-context";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTL } from "@/lib/products";
import { routes } from "@/lib/site";
import { EASE } from "@/lib/motion";
import { StepIndicator } from "./step-indicator";
import { PaymentStep } from "./payment-step";
import { ReviewStep } from "./review-step";
import { ConfirmationStep } from "./confirmation-step";
import { detectNetwork } from "./card-preview";
import { EMPTY_PAYMENT, STEP_ORDER, type PaymentData, type StepId } from "./types";
import { estimateDeliveryDate } from "./order-utils";

interface OrderSnapshot {
  orderNumber: string;
  deliveryDate: string;
  items: CartItem[];
  total: number;
  fullName: string;
  email: string;
  address: SavedAddress;
}

export function CheckoutFlow() {
  const { items, subtotal, hydrated: cartHydrated, clearCart } = useCart();
  const {
    fullName,
    email,
    hydrated: checkoutHydrated,
    getSelectedAddress,
  } = useCheckout();
  const { refresh } = useOrders();
  const { isLoggedIn, hydrated: authHydrated } = useAuth();
  const router = useRouter();

  const hydrated = cartHydrated && checkoutHydrated && authHydrated;
  const selectedAddress = getSelectedAddress();

  const [step, setStep] = useState<StepId>("payment");
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [payment, setPayment] = useState<PaymentData>(EMPTY_PAYMENT);
  const [orderSnapshot, setOrderSnapshot] = useState<OrderSnapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shippingCost =
    subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST;
  const total = subtotal + shippingCost;

  // Route guards: checkout needs a session, a cart and a delivery address.
  // The confirmation screen is exempt — by then the cart has been emptied.
  useEffect(() => {
    if (!hydrated || step === "confirmation") return;
    if (!isLoggedIn) {
      router.replace(`${routes.login}?next=${encodeURIComponent(routes.checkout)}`);
      return;
    }
    if (items.length === 0) {
      router.replace(routes.store);
      return;
    }
    if (!selectedAddress) {
      router.replace(routes.cart);
    }
  }, [hydrated, isLoggedIn, items.length, selectedAddress, step, router]);

  const goToStep = (target: StepId) => {
    const targetIndex = STEP_ORDER.indexOf(target);
    if (targetIndex <= furthestIndex && step !== "confirmation") {
      setStep(target);
    }
  };

  const handleConfirmOrder = async () => {
    if (submitting || !selectedAddress) return;
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const addressSnapshot = {
      label: selectedAddress.label,
      recipientName: selectedAddress.recipientName,
      phone: selectedAddress.phone,
      addressLine1: selectedAddress.addressLine1,
      addressLine2: selectedAddress.addressLine2,
      city: selectedAddress.city,
      district: selectedAddress.district,
      postalCode: selectedAddress.postalCode,
    };
    const isCard = payment.method === "card";
    const digits = isCard ? payment.cardNumber.replace(/\s/g, "") : "";

    // Order totals and the order number are produced by the `create_order`
    // Postgres function, not by the browser.
    const { data, error } = await supabase.rpc("create_order", {
      p_shipping_address: addressSnapshot,
      p_payment_method: payment.method,
      p_card_last4: isCard ? digits.slice(-4) : null,
      p_card_brand: isCard ? detectNetwork(digits) : null,
      p_card_expiry: isCard ? payment.expiry : null,
      p_card_name: isCard ? payment.cardName : null,
      p_full_name: fullName,
      p_email: email,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Sipariş oluşturulamadı. Lütfen tekrar deneyin.");
      return;
    }

    const result = (data ?? {}) as {
      order_number?: string;
      total?: number | string;
    };
    setOrderSnapshot({
      orderNumber: result.order_number ?? "",
      deliveryDate: estimateDeliveryDate(),
      items: [...items],
      total: Number(result.total ?? total),
      fullName,
      email,
      address: selectedAddress,
    });
    setFurthestIndex(STEP_ORDER.indexOf("confirmation"));
    setStep("confirmation");
    setPayment(EMPTY_PAYMENT);
    clearCart();
    await refresh();
  };

  // While the guards above decide, render nothing but keep the page height so
  // the footer does not jump into view.
  const blocked =
    !hydrated ||
    (step !== "confirmation" && (items.length === 0 || !selectedAddress));
  if (blocked) {
    return <div className="min-h-[60vh]" aria-busy="true" />;
  }

  return (
    <div className="wrap page-top pb-32">
      <div className="mx-auto max-w-3xl">
        {step !== "confirmation" && (
          <div className="mb-12">
            <StepIndicator
              current={step}
              furthestIndex={furthestIndex}
              onNavigate={goToStep}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {step === "payment" && (
              <PaymentStep
                payment={payment}
                onPaymentChange={setPayment}
                onContinue={() => {
                  setFurthestIndex((prev) => Math.max(prev, 1));
                  setStep("review");
                }}
                onBack={() => router.push(routes.cart)}
              />
            )}
            {step === "review" && selectedAddress && (
              <ReviewStep
                items={items}
                subtotal={subtotal}
                shippingCost={shippingCost}
                total={total}
                fullName={fullName}
                email={email}
                address={selectedAddress}
                payment={payment}
                onEditAddress={() => router.push(routes.cart)}
                onEditPayment={() => goToStep("payment")}
                onBack={() => setStep("payment")}
                onConfirm={handleConfirmOrder}
                submitting={submitting}
              />
            )}
            {step === "confirmation" && orderSnapshot && (
              <ConfirmationStep
                orderNumber={orderSnapshot.orderNumber}
                deliveryDate={orderSnapshot.deliveryDate}
                items={orderSnapshot.items}
                total={orderSnapshot.total}
                email={orderSnapshot.email}
                address={orderSnapshot.address}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {step === "payment" && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-ink/10 bg-ivory/95 px-6 py-3 backdrop-blur-sm md:hidden">
          <span className="label text-olive">{items.length} ürün</span>
          <span className="figure text-base text-ink">{formatTL(total)}</span>
        </div>
      )}
    </div>
  );
}
