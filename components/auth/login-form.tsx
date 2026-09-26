"use client";

import type React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { routes } from "@/lib/site";
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors";
import { customerLoginAction } from "@/app/auth/actions";
import { PENDING_EMAIL_KEY } from "@/components/auth/confirmation-pending";

/** Only same-origin paths may be used as a post-login destination. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return routes.account;
  }
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const submittedEmail = useRef("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  // SEC-05: password-based login now goes through a server action with
  // distributed rate limiting. OAuth stays on the browser client.
  const [loginState, loginAction] = useActionState(customerLoginAction, ACTION_IDLE);

  useEffect(() => {
    if (!loginState || loginState === ACTION_IDLE) return;
    const state = loginState as ActionState & { needsEmailConfirm?: boolean; redirectTo?: string };
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    } else if (state.needsEmailConfirm) {
      sessionStorage.setItem(PENDING_EMAIL_KEY, submittedEmail.current);
    } else if (!state.ok && state.message) {
      toast.error(state.message);
    }
  }, [loginState, router]);

  const handleSocialLogin = async (provider: "google" | "apple") => {
    const supabase = await getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (error) toast.error("Bu yöntemle giriş yapılamadı.");
  };

  return (
    <>
      <form action={loginAction} onSubmit={() => { submittedEmail.current = email.trim() }} noValidate className="space-y-7">
        <input type="hidden" name="next" value={next} />
        <TextField
          label="E-posta"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ornek@eposta.com"
          autoComplete="email"
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
          className="auth-field"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Checkbox
            label="Beni hatırla"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <Link href="/sifremi-unuttum" className="inline-flex min-h-11 items-center text-sm text-brand transition-colors hover:text-forest">
            Şifremi unuttum
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full">
          Giriş yap
        </Button>
      </form>

      {(loginState as ActionState & { needsEmailConfirm?: boolean }).needsEmailConfirm && (
        <p role="alert" className="mt-6 text-sm text-ink/65">
          E-postanızı doğrulamanız gerekiyor. <Link href="/eposta-onay-bekleniyor" className="text-brand hover:text-forest">Doğrulama e-postasını yeniden gönderin.</Link>
        </p>
      )}

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
