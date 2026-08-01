import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Kayıt ol",
  description: "Kabia hesabı oluşturun.",
  alternates: { canonical: "/kayit" },
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <PageShell>
      <AuthShell
        eyebrow="Hesap"
        title={
          <>
            Bahçeye <em className="font-serif italic text-brand">katılın</em>.
          </>
        }
        lead="Hesabınızla siparişlerinizi takip edin, adreslerinizi bir kez girin."
        image="/images/almonds-drying.jpg"
        imageCaption="Hasattan sonra kabuğunda kurutulan badem."
      >
        <RegisterForm />
      </AuthShell>
    </PageShell>
  );
}
