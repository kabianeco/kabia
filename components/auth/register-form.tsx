"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { routes } from "@/lib/site";
import { ACTION_IDLE } from "@/lib/admin/errors";
import { customerRegisterAction } from "@/app/auth/actions";
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from "@/lib/auth/password-policy";
import { startResendCooldown, writePendingEmail } from "@/lib/auth/pending";
import { TERMS_REQUIRED, type RegistrationFieldErrors } from "@/lib/auth/registration";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()]{10,20}$/;

const legalLink = "text-brand underline underline-offset-4 transition-colors duration-300 hover:text-forest";

export function RegisterForm() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const submittedEmail = useRef("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [kvkk, setKvkk] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});

  // SEC-05: registration goes through the rate-limited server action, which
  // re-checks every field and both consents.
  const [state, action, pending] = useActionState(customerRegisterAction, ACTION_IDLE);
  const serverFields = state !== ACTION_IDLE && !state.ok ? (state as { fields?: RegistrationFieldErrors }).fields : undefined;
  const serverMessage = state !== ACTION_IDLE && !state.ok && !serverFields ? state.message : undefined;
  const shown = { ...serverFields, ...errors };

  useEffect(() => {
    if (state === ACTION_IDLE || !state.ok) return;
    writePendingEmail(submittedEmail.current);
    // The code and link were just sent: the resend cooldown starts now.
    startResendCooldown("signup");
    router.push(routes.confirmationPending);
  }, [state, router]);

  const validate = (): boolean => {
    const found: RegistrationFieldErrors = {};
    if (name.trim().length < 2) found.name = "Ad soyad girin.";
    if (!EMAIL_RE.test(email.trim())) found.email = "Geçerli bir e-posta adresi girin.";
    if (!PHONE_RE.test(phone.trim())) found.phone = "Geçerli bir telefon numarası girin.";
    if (password.length < PASSWORD_MIN_LENGTH) found.password = PASSWORD_TOO_SHORT;
    if (!terms || !kvkk) found.consents = TERMS_REQUIRED;
    setErrors(found);
    const first = (["name", "email", "phone", "password"] as const).find((key) => found[key]) ?? (found.consents ? "terms" : null);
    if (first) form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
    return !first;
  };

  return (
    <>
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
        <TextField label="Ad soyad" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" error={shown.name} className="auth-field" required />
        <TextField label="E-posta" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@eposta.com" autoComplete="email" error={shown.email} className="auth-field" required />
        <TextField label="Telefon" type="tel" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" autoComplete="tel" error={shown.phone} className="auth-field" required />
        <PasswordField label="Şifre" name="password" value={password} onValueChange={setPassword} autoComplete="new-password" error={shown.password} strength required />

        <fieldset className="space-y-1 pt-2" aria-describedby={shown.consents ? "consents-error" : undefined}>
          <legend className="sr-only">Onaylar</legend>
          <Checkbox
            name="terms"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-invalid={shown.consents && !terms ? true : undefined}
            className="items-start py-2"
            label={
              <span className="leading-relaxed">
                <Link href={routes.termsOfUse} target="_blank" className={legalLink}>Üyelik Sözleşmesi</Link>’ni okudum ve kabul ediyorum.
              </span>
            }
          />
          <Checkbox
            name="kvkk"
            checked={kvkk}
            onChange={(e) => setKvkk(e.target.checked)}
            aria-invalid={shown.consents && !kvkk ? true : undefined}
            className="items-start py-2"
            label={
              <span className="leading-relaxed">
                <Link href={routes.kvkkDisclosure} target="_blank" className={legalLink}>KVKK Aydınlatma Metni</Link> ve{" "}
                <Link href={routes.privacyPolicy} target="_blank" className={legalLink}>Gizlilik Politikası</Link>’nı okudum.
              </span>
            }
          />
          <Checkbox
            name="marketing"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="items-start py-2"
            label={
              <span className="leading-relaxed text-ink/60">
                Kampanyalardan e-posta ile haberdar olmak istiyorum (
                <Link href={routes.explicitConsent} target="_blank" className={legalLink}>Açık Rıza Metni</Link>, isteğe bağlı).
              </span>
            }
          />
          {shown.consents && (
            <p id="consents-error" role="alert" className="text-xs text-clay">
              {shown.consents}
            </p>
          )}
        </fieldset>

        {serverMessage && (
          <p role="alert" className="text-sm text-clay">
            {serverMessage}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Hesap oluşturuluyor…" : <>Hesap oluştur <span aria-hidden="true">→</span></>}
        </Button>
      </form>

      <p className="mt-10 border-t border-ink/10 pt-8 text-sm text-ink/60">
        Hesabınız var mı?{" "}
        <Link href={routes.login} className="text-brand transition-colors duration-300 hover:text-forest">
          Giriş yapın
        </Link>
      </p>
    </>
  );
}
