"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { routes } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only same-origin paths may be used as a post-login destination. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return routes.account;
  }
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!EMAIL_RE.test(email.trim()))
      nextErrors.email = "Geçerli bir e-posta adresi girin.";
    if (password.length < 6)
      nextErrors.password = "Şifre en az 6 karakter olmalı.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error, needsEmailConfirm } = await login(email.trim(), password);
    setSubmitting(false);

    if (needsEmailConfirm) {
      toast.success("Devam etmek için e-postanızı onaylayın.");
      return;
    }
    if (error) {
      toast.error("E-posta veya şifre hatalı.");
      return;
    }
    router.push(next);
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (error) toast.error("Bu yöntemle giriş yapılamadı.");
  };

  const handleForgotPassword = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setErrors((prev) => ({
        ...prev,
        email: "Şifre sıfırlamak için önce e-posta adresinizi girin.",
      }));
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${routes.accountProfile}`,
    });
    if (error) toast.error("Sıfırlama bağlantısı gönderilemedi.");
    else toast.success("Şifre sıfırlama bağlantısını e-postanıza gönderdik.");
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-7">
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
          label="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password}
          className="auth-field"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Checkbox
            label="Beni hatırla"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <button
            type="button"
            onClick={handleForgotPassword}
            className="min-h-11 text-sm text-brand transition-colors hover:text-forest"
          >
            Şifremi unuttum
          </button>
        </div>

        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Giriş yapılıyor…" : "Giriş yap"}
        </Button>
      </form>

      <div className="mt-10 flex items-center gap-4">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="label text-olive">veya</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => handleSocialLogin("google")}>
          Google
        </Button>
        <Button variant="outline" onClick={() => handleSocialLogin("apple")}>
          Apple
        </Button>
      </div>

      <p className="mt-10 text-sm text-ink/60">
        Hesabınız yok mu?{" "}
        <Link
          href={routes.register}
          className="text-brand transition-colors hover:text-forest"
        >
          Kayıt olun
        </Link>
      </p>
    </>
  );
}
