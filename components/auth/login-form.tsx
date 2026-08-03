"use client";

import type React from "react";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { routes } from "@/lib/site";
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors";
import { customerLoginAction, customerResetPasswordAction } from "@/app/auth/actions";

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
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // SEC-05: password-based login now goes through a server action with
  // distributed rate limiting. OAuth stays on the browser client.
  const [loginState, loginAction] = useActionState(customerLoginAction, ACTION_IDLE);
  const [, resetAction] = useActionState(customerResetPasswordAction, ACTION_IDLE);

  useEffect(() => {
    if (!loginState || loginState === ACTION_IDLE) return;
    const state = loginState as ActionState & { needsEmailConfirm?: boolean; redirectTo?: string };
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    } else if (state.needsEmailConfirm) {
      toast.success("Devam etmek için e-postanızı onaylayın.");
    } else if (!state.ok && state.message) {
      toast.error(state.message);
    }
  }, [loginState, router]);

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
    // SEC-05: password reset goes through the rate-limited server action.
    const formData = new FormData();
    formData.set("email", email.trim());
    await resetAction(formData);
    toast.success("Şifre sıfırlama bağlantısını e-postanıza gönderdik (eğer hesap bulunduysa).");
  };

  return (
    <>
      <form action={loginAction} noValidate className="space-y-7">
        <input type="hidden" name="next" value={next} />
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
          label="Şifre"
          type="password"
          name="password"
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

        <Button type="submit" size="lg" className="w-full">
          Giriş yap
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