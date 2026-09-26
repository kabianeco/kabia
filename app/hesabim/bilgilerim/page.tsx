"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { AccountHeading } from "@/components/account/account-states";
import { useAuth } from "@/lib/auth-context";
import { ACTION_IDLE } from "@/lib/admin/errors";
import { updateProfileAction } from "@/app/hesabim/actions";
import { routes } from "@/lib/site";

export default function ProfilePage() {
  const { user, applyProfile } = useAuth();
  // Fields show the loaded profile until edited; the profile row may arrive
  // after this page mounts.
  const [edits, setEdits] = useState<{ name?: string; phone?: string; birthDate?: string }>({});
  const name = edits.name ?? user?.name ?? "";
  const phone = edits.phone ?? user?.phone ?? "";
  const birthDate = edits.birthDate ?? user?.birthDate ?? "";
  const edit = (key: "name" | "phone" | "birthDate") => (e: { target: { value: string } }) =>
    setEdits((prev) => ({ ...prev, [key]: e.target.value }));
  const [state, action, pending] = useActionState(updateProfileAction, ACTION_IDLE);
  const applied = useRef<typeof state | null>(null);

  useEffect(() => {
    if (state === ACTION_IDLE || !state.ok || applied.current === state) return;
    applied.current = state;
    const saved = (state as { profile?: { full_name: string; phone: string | null; birth_date: string | null } }).profile;
    if (saved) applyProfile(saved);
  }, [state, applyProfile]);

  const fieldErrors = state !== ACTION_IDLE && !state.ok ? state.fieldErrors ?? {} : {};
  const formError = state !== ACTION_IDLE && !state.ok && !state.fieldErrors ? state.message : undefined;

  return (
    <div className="max-w-xl">
      <AccountHeading title="Bilgilerim" />

      <form action={action} noValidate className="mt-12 space-y-7">
        <TextField label="Ad soyad" name="name" value={name} onChange={edit("name")} autoComplete="name" error={fieldErrors.name} />
        <TextField label="Telefon" type="tel" name="phone" value={phone} onChange={edit("phone")} autoComplete="tel" placeholder="05XX XXX XX XX" error={fieldErrors.phone} />
        <TextField label="Doğum tarihi" type="date" name="birthDate" value={birthDate} onChange={edit("birthDate")} hint="İsteğe bağlı" error={fieldErrors.birthDate} />

        <div className="flex flex-wrap items-center gap-6">
          <Button type="submit" disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <p role="status" aria-live="polite" className={`text-sm ${formError ? "text-clay" : "text-ink/60"}`}>
            {state === ACTION_IDLE || pending ? "" : state.ok ? state.message : formError}
          </p>
        </div>
      </form>

      <div className="mt-14 flex flex-wrap items-baseline justify-between gap-4 border-t border-ink/10 pt-8">
        <div className="min-w-0">
          <p className="label text-olive">E-posta</p>
          <p className="mt-2 break-all text-base text-ink">{user?.email}</p>
        </div>
        <Link href={`${routes.accountSecurity}#eposta`} className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest">
          Değiştir
        </Link>
      </div>
    </div>
  );
}
