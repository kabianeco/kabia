"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { AccountError, AccountHeading, AccountLoading } from "@/components/account/account-states";
import { useCampaignConsent } from "@/lib/notification-prefs";
import { setMarketingConsentAction } from "@/app/hesabim/actions";
import { ACTION_IDLE } from "@/lib/admin/errors";
import { routes } from "@/lib/site";

export default function NotificationPreferencesPage() {
  const { granted, setGranted, hydrated, error, retry } = useCampaignConsent();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const change = (next: boolean) => {
    const previous = granted;
    setGranted(next);
    setStatus(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("granted", String(next));
      const result = await setMarketingConsentAction(ACTION_IDLE, form);
      if (!result.ok) setGranted(previous);
      setStatus({ ok: result.ok, text: result.ok ? "Kaydedildi." : result.message ?? "Tercihiniz kaydedilemedi." });
    });
  };

  return (
    <div className="max-w-xl">
      <AccountHeading title="Bildirimler" />

      {!hydrated ? (
        <AccountLoading label="Tercihleriniz yükleniyor" rows={1} />
      ) : error ? (
        <AccountError message="Tercihleriniz şu anda yüklenemedi." onRetry={retry} />
      ) : (
        <>
          <div className="mt-10 border-t border-ink/10">
            <Switch
              label="Kampanya e-postaları"
              description="Yeni hasat ve fırsatlardan e-posta ile haberdar olun. İzniniz Açık Rıza Metni kapsamında kaydedilir; dilediğinizde kapatabilirsiniz."
              checked={granted}
              onCheckedChange={change}
              disabled={pending}
            />
          </div>
          <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${status && !status.ok ? "text-clay" : "text-ink/60"}`}>
            {pending ? "Kaydediliyor…" : status?.text}
          </p>
          <p className="mt-8 text-sm leading-relaxed text-ink/60">
            Sipariş, kargo ve stok bildirimleri henüz gönderilmiyor; hazır olduklarında burada seçebileceksiniz. Siparişlerinizin durumunu{" "}
            <Link href={routes.accountOrders} className="text-brand transition-colors duration-300 hover:text-forest">
              Siparişlerim
            </Link>{" "}
            sayfasından izleyebilirsiniz.
          </p>
        </>
      )}
    </div>
  );
}
