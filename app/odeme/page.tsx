import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = {
  title: "Ödeme",
  description: "Kabia siparişinizi tamamlayın.",
  alternates: { canonical: "/odeme" },
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <PageShell>
      <CheckoutFlow />
    </PageShell>
  );
}
