"use client";

import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()]{10,}$/;

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? "");
  const [profileErrors, setProfileErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    next?: string;
    repeat?: string;
  }>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof profileErrors = {};
    if (name.trim().length < 2) errors.name = "Ad soyad girin.";
    if (!EMAIL_RE.test(email.trim()))
      errors.email = "Geçerli bir e-posta adresi girin.";
    if (!PHONE_RE.test(phone.trim()))
      errors.phone = "Geçerli bir telefon numarası girin.";
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingProfile(true);
    const { error } = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      birthDate: birthDate || undefined,
    });

    if (error) {
      toast.error("Bilgiler kaydedilemedi. Lütfen tekrar deneyin.");
      setSavingProfile(false);
      return;
    }

    // Changing the address on file requires Supabase to reconfirm it.
    if (email.trim() !== (user?.email ?? "")) {
      const supabase = createSupabaseBrowserClient();
      const { error: emailError } = await supabase.auth.updateUser({
        email: email.trim(),
      });
      if (emailError) {
        toast.error("E-posta güncellenemedi. Adresi kontrol edin.");
      } else {
        toast.success("E-posta değişikliği için onay bağlantısı gönderildi.");
      }
    } else {
      toast.success("Bilgileriniz güncellendi.");
    }
    setSavingProfile(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof passwordErrors = {};
    if (currentPassword.trim().length === 0)
      errors.current = "Mevcut şifrenizi girin.";
    if (newPassword.length < 6)
      errors.next = "Yeni şifre en az 6 karakter olmalı.";
    if (newPasswordRepeat !== newPassword)
      errors.repeat = "Şifreler eşleşmiyor.";
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error("Şifre güncellenemedi. Lütfen tekrar deneyin.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordRepeat("");
    toast.success("Şifreniz güncellendi.");
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl tracking-tight md:text-4xl">Bilgilerim</h1>

      <form onSubmit={handleProfileSubmit} noValidate className="mt-12 space-y-7">
        <TextField
          label="Ad soyad"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          error={profileErrors.name}
        />
        <TextField
          label="E-posta"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          hint="Değiştirirseniz yeni adrese onay bağlantısı göndeririz."
          error={profileErrors.email}
        />
        <TextField
          label="Telefon"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          error={profileErrors.phone}
        />
        <TextField
          label="Doğum tarihi"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          hint="İsteğe bağlı"
        />
        <Button type="submit" disabled={savingProfile}>
          {savingProfile ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </form>

      <section
        aria-labelledby="password-heading"
        className="mt-16 border-t border-ink/10 pt-12"
      >
        <h2 id="password-heading" className="text-2xl tracking-tight">
          Şifre değiştir
        </h2>
        <form
          onSubmit={handlePasswordSubmit}
          noValidate
          className="mt-8 space-y-7"
        >
          <TextField
            label="Mevcut şifre"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            error={passwordErrors.current}
          />
          <div className="grid gap-7 sm:grid-cols-2">
            <TextField
              label="Yeni şifre"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              hint="En az 6 karakter"
              error={passwordErrors.next}
            />
            <TextField
              label="Yeni şifre tekrar"
              type="password"
              value={newPasswordRepeat}
              onChange={(e) => setNewPasswordRepeat(e.target.value)}
              autoComplete="new-password"
              error={passwordErrors.repeat}
            />
          </div>
          <Button type="submit" variant="outline" disabled={savingPassword}>
            {savingPassword ? "Güncelleniyor…" : "Şifreyi güncelle"}
          </Button>
        </form>
      </section>
    </div>
  );
}
