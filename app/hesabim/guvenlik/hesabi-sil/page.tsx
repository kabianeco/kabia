"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { AccountHeading } from "@/components/account/account-states";
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors";
import { deleteAccountAction } from "@/app/hesabim/actions";
import { ORDER_RECORD_RETENTION_YEARS } from "@/lib/account/retention";
import { routes } from "@/lib/site";

/**
 * Deleting the account: what goes, what legally stays, one confirmation, the
 * current password, one button. The server repeats every check.
 */
export default function DeleteAccountPage() {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(deleteAccountAction, ACTION_IDLE);
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === ACTION_IDLE || !state.ok || handled.current === state) return;
    handled.current = state;
    const redirectTo = (state as ActionState & { redirectTo?: string }).redirectTo;
    // Full navigation: the session no longer exists; drop all client state.
    if (redirectTo) window.location.assign(redirectTo);
  }, [state]);

  const errors = state !== ACTION_IDLE && !state.ok ? state.fieldErrors ?? {} : {};
  const failure = state !== ACTION_IDLE && !state.ok && !state.fieldErrors ? state.message : undefined;
  const done = state !== ACTION_IDLE && state.ok;

  return (
    <div className="max-w-xl">
      <Link href={routes.accountSecurity} className="inline-flex min-h-11 items-center text-sm text-ink/55 transition-colors hover:text-ink">
        ← Güvenlik
      </Link>
      <div className="mt-4">
        <AccountHeading title="Hesabınızı silin" />
      </div>
      <p className="mt-6 text-base leading-relaxed text-ink/65">
        Profiliniz, adresleriniz, favorileriniz, yorumlarınız ve tercihleriniz silinir. Sipariş kayıtları yasal
        zorunluluk nedeniyle {ORDER_RECORD_RETENTION_YEARS} yıl saklanır. Bu işlem geri alınamaz.
      </p>
      <p className="mt-4 text-sm text-ink/60">
        Önce{" "}
        <Link href={routes.accountSecurity} className="text-brand transition-colors duration-300 hover:text-forest">
          verilerinizin bir kopyasını indirebilirsiniz
        </Link>
        .
      </p>

      <form action={action} noValidate className="mt-10 space-y-7">
        <PasswordField
          label="Mevcut şifre"
          name="currentPassword"
          value={password}
          onValueChange={setPassword}
          autoComplete="current-password"
          error={errors.currentPassword}
          required
        />
        <div>
          <Checkbox
            name="confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={errors.confirm ? "confirm-error" : undefined}
            className="items-start py-2"
            label={<span className="leading-relaxed">Hesabımın ve verilerimin kalıcı olarak silineceğini anlıyorum.</span>}
          />
          {errors.confirm && (
            <p id="confirm-error" role="alert" className="mt-1 text-xs text-clay">
              {errors.confirm}
            </p>
          )}
        </div>
        {failure && (
          <p role="alert" className="text-sm text-clay">
            {failure}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          disabled={pending || done}
          className="hover:border-clay hover:text-clay"
        >
          {pending || done ? "Siliniyor…" : "Hesabımı sil"}
        </Button>
      </form>
    </div>
  );
}
