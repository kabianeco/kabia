"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { AccountHeading } from "@/components/account/account-states";
import { useAuth } from "@/lib/auth-context";
import { ACTION_IDLE, type ActionState } from "@/lib/admin/errors";
import {
  changeEmailAction,
  changePasswordAction,
  exportDataAction,
  signOutEverywhereAction,
} from "@/app/hesabim/actions";
import { routes } from "@/lib/site";

type Panel = "password" | "email" | "sessions" | "export" | null;

/** One ledger row: what it is, one line of state, one quiet action. */
function Row({
  id,
  title,
  detail,
  action,
  open,
  onToggle,
  notice,
  children,
}: {
  id?: string;
  title: string;
  detail: ReactNode;
  action?: string;
  open?: boolean;
  onToggle?: () => void;
  notice?: string;
  children?: ReactNode;
}) {
  const panelId = useId();
  return (
    <li id={id} className="scroll-mt-32 border-b border-ink/10 py-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-base text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/60">{detail}</p>
        </div>
        {action && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="-mt-3 inline-flex min-h-11 shrink-0 items-center text-sm text-brand transition-colors duration-300 hover:text-forest"
          >
            {open ? "Vazgeç" : action}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-ink/65 empty:hidden [&:not(:empty)]:mt-3">
        {notice}
      </p>
      {open && (
        <div id={panelId} className="mt-6">
          {children}
        </div>
      )}
    </li>
  );
}

/** Runs `effect` once per successful result, however often the parent re-renders. */
function useOnSuccess<S extends ActionState>(state: S, effect: (state: S) => void) {
  const handled = useRef<S | null>(null);
  useEffect(() => {
    if (state === ACTION_IDLE || !state.ok || handled.current === state) return;
    handled.current = state;
    effect(state);
  }, [state, effect]);
}

function formError(state: ActionState): string | undefined {
  return state !== ACTION_IDLE && !state.ok && !state.fieldErrors ? state.message : undefined;
}

function FormFailure({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-clay">
      {message}
    </p>
  ) : null;
}

function PasswordForm({ onDone }: { onDone: (message: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, action, pending] = useActionState(changePasswordAction, ACTION_IDLE);
  useOnSuccess(state, (result) => onDone(result.message ?? "Şifreniz güncellendi."));
  const errors = state !== ACTION_IDLE && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} noValidate className="max-w-md space-y-7">
      <PasswordField label="Mevcut şifre" name="currentPassword" value={current} onValueChange={setCurrent} autoComplete="current-password" error={errors.currentPassword} required />
      <PasswordField label="Yeni şifre" name="newPassword" value={next} onValueChange={setNext} autoComplete="new-password" error={errors.newPassword} strength required />
      <FormFailure message={formError(state)} />
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Şifreyi değiştir"}
      </Button>
    </form>
  );
}

function EmailForm({ onDone }: { onDone: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [state, action, pending] = useActionState(changeEmailAction, ACTION_IDLE);
  useOnSuccess(state, (result) => onDone(result.message ?? ""));
  const errors = state !== ACTION_IDLE && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} noValidate className="max-w-md space-y-7">
      <TextField label="Yeni e-posta" type="email" name="newEmail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" error={errors.newEmail} required />
      <PasswordField label="Mevcut şifre" name="currentPassword" value={current} onValueChange={setCurrent} autoComplete="current-password" error={errors.currentPassword} required />
      <FormFailure message={formError(state)} />
      <Button type="submit" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Onay bağlantısı gönder"}
      </Button>
    </form>
  );
}

function SessionsForm() {
  const [current, setCurrent] = useState("");
  const [state, action, pending] = useActionState(signOutEverywhereAction, ACTION_IDLE);
  // Full navigation: every client-side cache of this account is dropped too.
  useOnSuccess(state, (result) => {
    const redirectTo = (result as ActionState & { redirectTo?: string }).redirectTo;
    if (redirectTo) window.location.assign(redirectTo);
  });
  const errors = state !== ACTION_IDLE && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} noValidate className="max-w-md space-y-7">
      <PasswordField label="Mevcut şifre" name="currentPassword" value={current} onValueChange={setCurrent} autoComplete="current-password" error={errors.currentPassword} required />
      <FormFailure message={formError(state)} />
      <Button type="submit" disabled={pending || (state !== ACTION_IDLE && state.ok)}>
        {pending ? "Çıkış yapılıyor…" : "Tüm cihazlardan çıkış yap"}
      </Button>
    </form>
  );
}

function ExportForm({ onDone }: { onDone: (message: string) => void }) {
  const [current, setCurrent] = useState("");
  const [state, action, pending] = useActionState(exportDataAction, ACTION_IDLE);
  useOnSuccess(state, (result) => {
    const { data, filename } = result as ActionState & { data?: string; filename?: string };
    if (!data || !filename) return;
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    onDone(result.message ?? "Verileriniz indirildi.");
  });
  const errors = state !== ACTION_IDLE && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} noValidate className="max-w-md space-y-7">
      <PasswordField label="Mevcut şifre" name="currentPassword" value={current} onValueChange={setCurrent} autoComplete="current-password" error={errors.currentPassword} required />
      <FormFailure message={formError(state)} />
      <Button type="submit" disabled={pending}>
        {pending ? "Hazırlanıyor…" : "Verilerimi indir"}
      </Button>
    </form>
  );
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState<Panel>(null);
  const [notices, setNotices] = useState<Partial<Record<Exclude<Panel, null>, string>>>({});

  // /hesabim/guvenlik#eposta (from Bilgilerim) opens the e-mail row directly.
  useEffect(() => {
    if (window.location.hash !== "#eposta") return;
    const opened = setTimeout(() => setOpen("email"), 0);
    return () => clearTimeout(opened);
  }, []);

  const toggle = (panel: Exclude<Panel, null>) => () => {
    setOpen((current) => (current === panel ? null : panel));
    setNotices((prev) => ({ ...prev, [panel]: undefined }));
  };
  const done = (panel: Exclude<Panel, null>) => (message: string) => {
    setOpen(null);
    setNotices((prev) => ({ ...prev, [panel]: message }));
  };

  return (
    <div className="max-w-2xl">
      <AccountHeading title="Güvenlik" />

      <ul className="mt-12 border-t border-ink/10">
        <Row title="Şifre" detail="Değiştirmek için mevcut şifreniz gerekir." action="Değiştir" open={open === "password"} onToggle={toggle("password")} notice={notices.password}>
          <PasswordForm onDone={done("password")} />
        </Row>
        <Row
          id="eposta"
          title="E-posta"
          detail={<span className="break-all">{user?.email}</span>}
          action="Değiştir"
          open={open === "email"}
          onToggle={toggle("email")}
          notice={notices.email}
        >
          <EmailForm onDone={done("email")} />
        </Row>
        <Row
          title="Tüm cihazlardan çıkış"
          detail="Bu cihaz dahil hesabınızın açık olduğu her yerden çıkış yapar. Diğer cihazlarda oturum kısa süre içinde kapanır."
          action="Çıkış yap"
          open={open === "sessions"}
          onToggle={toggle("sessions")}
        >
          <SessionsForm />
        </Row>
        <Row title="İki adımlı doğrulama" detail="Yakında." />
        <Row
          title="Verileriniz"
          detail="Hesabınızdaki kişisel verilerin bir kopyasını indirin (JSON)."
          action="İndir"
          open={open === "export"}
          onToggle={toggle("export")}
          notice={notices.export}
        >
          <ExportForm onDone={done("export")} />
        </Row>
      </ul>

      <p className="mt-10 text-sm">
        <Link href={routes.accountDelete} className="inline-flex min-h-11 items-center text-ink/55 transition-colors duration-300 hover:text-clay">
          Hesabımı sil
        </Link>
      </p>
    </div>
  );
}
