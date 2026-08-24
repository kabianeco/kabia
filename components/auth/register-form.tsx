"use client";

import type React from "react";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { routes } from "@/lib/site";
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors";
import { customerRegisterAction } from "@/app/auth/actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()]{10,}$/;

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordRepeat?: string;
  terms?: string;
}

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [terms, setTerms] = useState(false);
  const [kvkk, setKvkk] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // SEC-05: registration goes through the rate-limited server action.
  const [registerState, registerAction] = useActionState(customerRegisterAction, ACTION_IDLE);

  useEffect(() => {
    if (!registerState || registerState === ACTION_IDLE) return;
    if ((registerState as ActionState & { needsEmailConfirm?: boolean }).needsEmailConfirm) {
      toast.success("Hesabınızı oluşturduk. Devam etmek için e-postanızı onaylayın.");
      router.push(routes.login);
      return;
    }
    if (registerState.ok) {
      router.push(routes.account);
      return;
    }
    if (registerState.message) {
      toast.error(registerState.message);
    }
  }, [registerState, router]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (name.trim().length < 2) nextErrors.name = "Ad soyad girin.";
    if (!EMAIL_RE.test(email.trim()))
      nextErrors.email = "Geçerli bir e-posta adresi girin.";
    if (!PHONE_RE.test(phone.trim()))
      nextErrors.phone = "Geçerli bir telefon numarası girin.";
    if (password.length < 6)
      nextErrors.password = "Şifre en az 6 karakter olmalı.";
    if (passwordRepeat !== password)
      nextErrors.passwordRepeat = "Şifreler eşleşmiyor.";
    if (!terms || !kvkk)
      nextErrors.terms = "Üyelik sözleşmesi ve KVKK metinlerini onaylamanız gerekiyor.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  return (
    <>
      <form action={registerAction} onSubmit={(e) => { if (!validate()) e.preventDefault(); }} noValidate className="space-y-7">
        <TextField
          label="Ad soyad"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          error={errors.name}
          className="auth-field"
          required
        />
        <TextField
          label="E-posta"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@eposta.com"
          autoComplete="email"
          error={errors.email}
          className="auth-field"
          required
        />
        <TextField
          label="Telefon"
          type="tel"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05XX XXX XX XX"
          autoComplete="tel"
          error={errors.phone}
          className="auth-field"
          required
        />
        <TextField
          label="Şifre"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="En az 6 karakter"
          autoComplete="new-password"
          error={errors.password}
          className="auth-field"
          required
        />
        <TextField
          label="Şifre tekrar"
          type="password"
          name="passwordRepeat"
          value={passwordRepeat}
          onChange={(e) => setPasswordRepeat(e.target.value)}
          autoComplete="new-password"
          error={errors.passwordRepeat}
          className="auth-field"
          required
        />

        {/* Yasal onaylar — gerçek e-ticaret siteleriyle uyumlu */}
        <div className="space-y-4 rounded-theme-card border border-ink/10 bg-paper p-5">
          <p className="label text-olive">Yasal onaylar</p>
          <div>
            <Checkbox
              label={
                <span className="leading-relaxed">
                  <Link href={routes.termsOfUse} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
                    Üyelik Sözleşmesi ve Kullanım Koşulları
                  </Link>
                  ’nı okudum, onaylıyorum. <span className="text-clay">*</span>
                </span>
              }
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={!!errors.terms || undefined}
              aria-describedby={errors.terms ? "terms-error" : undefined}
            />
          </div>
          <div>
            <Checkbox
              label={
                <span className="leading-relaxed">
                  <Link href={routes.kvkkDisclosure} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
                    KVKK Aydınlatma Metni
                  </Link>{" "}
                  ve{" "}
                  <Link href={routes.privacyPolicy} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
                    Gizlilik Politikası
                  </Link>
                  ’nı okudum, kişisel verilerimin işlenmesini onaylıyorum. <span className="text-clay">*</span>
                </span>
              }
              checked={kvkk}
              onChange={(e) => setKvkk(e.target.checked)}
              aria-invalid={!!errors.terms || undefined}
              aria-describedby={errors.terms ? "terms-error" : undefined}
            />
          </div>
          {errors.terms && (
            <p id="terms-error" role="alert" className="text-xs text-clay">
              {errors.terms}
            </p>
          )}
          <div className="border-t border-ink/10 pt-4">
            <Checkbox
              label={
                <span className="leading-relaxed text-ink/60">
                  Kampanya, indirim ve yeniliklerden haberdar olmak için{" "}
                  <Link href={routes.explicitConsent} target="_blank" className="text-brand hover:text-forest underline underline-offset-4">
                    Açık Rıza Metni
                  </Link>{" "}
                  kapsamında ticari elektronik ileti almak istiyorum. (İsteğe bağlı)
                </span>
              }
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
            />
            <input type="hidden" name="marketing_consent" value={marketing ? "1" : "0"} />
          </div>
          <p className="text-xs leading-relaxed text-ink/45">
            <span className="text-clay">*</span> işaretli alanların onayı üyelik için zorunludur. Verileriniz KVKK’ya uygun işlenir; dilediğiniz zaman
            hesabınızdan veya <Link href={routes.kvkkDisclosure} className="underline underline-offset-4">başvuru</Link> ile haklarınızı kullanabilirsiniz.
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full">
          Hesap oluştur
        </Button>
      </form>

      <p className="mt-10 text-sm text-ink/60">
        Hesabınız var mı?{" "}
        <Link
          href={routes.login}
          className="text-brand transition-colors hover:text-forest"
        >
          Giriş yapın
        </Link>
      </p>
    </>
  );
}