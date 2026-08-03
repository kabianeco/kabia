"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { useAuth } from "@/lib/auth-context";
import { routes } from "@/lib/site";

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
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!terms)
      nextErrors.terms = "Devam etmek için kullanım şartlarını kabul edin.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error, needsEmailConfirm } = await register({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    });
    setSubmitting(false);

    if (needsEmailConfirm) {
      toast.success("Hesabınızı oluşturduk. Devam etmek için e-postanızı onaylayın.");
      router.push(routes.login);
      return;
    }
    if (error) {
      toast.error("Hesap oluşturulamadı. Bilgilerinizi kontrol edin.");
      return;
    }
    router.push(routes.account);
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-7">
        <TextField
          label="Ad soyad"
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
          value={passwordRepeat}
          onChange={(e) => setPasswordRepeat(e.target.value)}
          autoComplete="new-password"
          error={errors.passwordRepeat}
          className="auth-field"
          required
        />

        <div>
          <Checkbox
            label="Kullanım şartlarını ve gizlilik politikasını kabul ediyorum."
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-invalid={!!errors.terms || undefined}
            aria-describedby={errors.terms ? "terms-error" : undefined}
          />
          {errors.terms && (
            <p id="terms-error" role="alert" className="mt-2 text-xs text-clay">
              {errors.terms}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
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
