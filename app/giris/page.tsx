import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Giriş yap",
  description: "Kabia hesabınıza giriş yapın.",
  alternates: { canonical: "/giris" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <PageShell>
      <AuthShell
        eyebrow="Hesap"
        title={
          <>
            Tekrar <em className="font-serif italic text-brand">hoş geldiniz</em>.
          </>
        }
        lead="Siparişlerinizi takip etmek ve adreslerinizi saklamak için giriş yapın."
        image="/images/orchard-hillside.jpg"
        imageCaption="Sabırlar köyünün yamaçlarında, dört mevsim aynı bahçe."
      >
        {/* useSearchParams needs a suspense boundary during prerender. */}
        <Suspense fallback={<div className="min-h-[28rem]" />}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </PageShell>
  );
}
