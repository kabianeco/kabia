import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { CartPage } from "@/components/cart/cart-page";

export const metadata: Metadata = {
  title: "Sepetim",
  description: "Kabia sepetiniz: ürünler, teslimat bilgileri ve toplam tutar.",
  alternates: { canonical: "/sepet" },
  robots: { index: false, follow: true },
};

export default function SepetPage() {
  return (
    <PageShell>
      <CartPage />
    </PageShell>
  );
}
