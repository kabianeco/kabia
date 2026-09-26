"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { routes } from "@/lib/site";
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors";
import { customerLoginAction } from "@/app/auth/actions";
import { writePendingEmail } from "@/lib/auth/pending";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only same-origin paths may be used as a post-login destination. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return routes.account;
  }
  return next;
}

type LoginState = ActionState & { needsEmailConfirm?: boolean; redirectTo?: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const signedOutEverywhere = searchParams.get("cikis") === "tum";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const submittedEmail = useRef("");
  const form = useRef<HTMLFormElement>(null);

  // SEC-05: password login goes through the rate-limited server action.
  const [state, action, pending] = useActionState(customerLoginAction, ACTION_IDLE);
  const result = state as LoginState;

  useEffect(() => {
    if (result === ACTION_IDLE) return;
    if (result.ok && result.redirectTo) router.push(result.redirectTo);
    else if (result.needsEmailConfirm) writePendingEmail(submittedEmail.current);
  }, [result, router]);

  const serverError = result !== ACTION_IDLE && !result.ok && !result.needsEmailConfirm ? result.message : undefined;

  const validate = () => {
    const found: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = "Geçerli bir e-posta adresi girin.";
    if (!password) found.password = "Şifrenizi girin.";
    setErrors(found);
    const first = found.email ? "email" : found.password ? "password" : null;
    if (first) form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
    return !first;
  };

  return (
    <>
      {signedOutEverywhere && (
        <p role="status" className="mb-10 text-sm text-ink/65">
          Tüm cihazlardan çıkış yapıldı. Yeniden giriş yapabilirsiniz.
        </p>
      )}

      <form
        ref={form}
        action={action}
        onSubmit={(event) => {
          if (!validate()) event.preventDefault();
          else submittedEmail.current = email.trim();
        }}
        noValidate
        className="space-y-7"
      >
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
        <PasswordField
          label="Şifre"
          name="password"
          value={password}
          onValueChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password ?? serverError}
          required
        />

        <div className="flex justify-end">
          <Link href={routes.forgotPassword} className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest">
            Şifremi unuttum
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Giriş yapılıyor…" : <>Giriş yap <span aria-hidden="true">→</span></>}
        </Button>

        {result.needsEmailConfirm && (
          <p role="alert" className="text-sm text-ink/65">
            E-postanızı henüz doğrulamadınız.{" "}
            <Link href={routes.verificationCode} className="text-brand transition-colors duration-300 hover:text-forest">
              Kodla doğrulayın
            </Link>
          </p>
        )}
      </form>

      <p className="mt-10 border-t border-ink/10 pt-8 text-sm text-ink/60">
        Hesabınız yok mu?{" "}
        <Link href={routes.register} className="text-brand transition-colors duration-300 hover:text-forest">
          Kayıt olun
        </Link>
      </p>
    </>
  );
}
