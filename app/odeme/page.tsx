import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { MotionRoot } from "@/components/motion/motion-root";

export const metadata: Metadata = {
  title: "Ödeme",
  description: "Kabia siparişinizi tamamlayın.",
  alternates: { canonical: "/odeme" },
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <PageShell>
      {/* Checkout steps animate in on first paint: features ship with the route. */}
      <MotionRoot>
        <CheckoutFlow />
      </MotionRoot>
    </PageShell>
  );
}
