"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { AccountError, AccountHeading, AccountLoading } from "@/components/account/account-states";
import { useCampaignConsent, useOrderStatusConsent } from "@/lib/notification-prefs";
import { setMarketingConsentAction, setOrderStatusAction } from "@/app/hesabim/actions";
import { ACTION_IDLE } from "@/lib/admin/errors";
import { routes } from "@/lib/site";

export default function NotificationPreferencesPage() {
  const campaign = useCampaignConsent();
  const orderStatus = useOrderStatusConsent();
  const [pending, startTransition] = useTransition();
  const [campaignStatus, setCampaignStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [orderStatusState, setOrderStatusState] = useState<{ ok: boolean; text: string } | null>(null);

  const changeCampaign = (next: boolean) => {
    const previous = campaign.granted;
    campaign.setGranted(next);
    setCampaignStatus(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("granted", String(next));
      const result = await setMarketingConsentAction(ACTION_IDLE, form);
      if (!result.ok) campaign.setGranted(previous);
      setCampaignStatus({ ok: result.ok, text: result.ok ? "Kaydedildi." : result.message ?? "Tercihiniz kaydedilemedi." });
    });
  };

  // İyimser çevirme yok: anahtar yalnızca sunucu "kaydedildi" deyince
  // çevrilir; hata aynen gösterilir, eski değer korunur.
  const changeOrderStatus = (next: boolean) => {
    setOrderStatusState(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("granted", String(next));
      const result = await setOrderStatusAction(ACTION_IDLE, form);
      if (result.ok) orderStatus.setGranted(next);
      setOrderStatusState({ ok: result.ok, text: result.ok ? "Kaydedildi." : result.message ?? "Tercihiniz kaydedilemedi." });
    });
  };

  const hydrated = campaign.hydrated && orderStatus.hydrated;
  const loadError = campaign.error || orderStatus.error;
  const retry = () => {
    campaign.retry();
    orderStatus.retry();
  };

  return (
    <div className="max-w-xl">
      <AccountHeading title="Bildirimler" />

      {!hydrated ? (
        <AccountLoading label="Tercihleriniz yükleniyor" rows={2} />
      ) : loadError ? (
        <AccountError message="Tercihleriniz şu anda yüklenemedi." onRetry={retry} />
      ) : (
        <>
          <div className="mt-10 border-t border-ink/10">
            <Switch
              label="Kampanya e-postaları"
              description="Yeni hasat ve fırsatlardan e-posta ile haberdar olun. İzniniz Açık Rıza Metni kapsamında kaydedilir; dilediğinizde kapatabilirsiniz."
              checked={campaign.granted}
              onCheckedChange={changeCampaign}
              disabled={pending}
            />
          </div>
          <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${campaignStatus && !campaignStatus.ok ? "text-clay" : "text-ink/60"}`}>
            {pending ? "Kaydediliyor…" : campaignStatus?.text}
          </p>
          <div className="mt-6 border-t border-ink/10">
            <Switch
              label="Kargo ve teslimat bildirimleri"
              description="Siparişiniz kargoya verildiğinde ve teslim edildiğinde e-posta alın. Sipariş alındı ve iptal e-postaları her zaman gönderilir; bu anahtar yalnızca kargo ve teslimat bildirimlerini kapatır."
              checked={orderStatus.granted}
              onCheckedChange={changeOrderStatus}
              disabled={pending}
            />
          </div>
          <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${orderStatusState && !orderStatusState.ok ? "text-clay" : "text-ink/60"}`}>
            {pending ? "Kaydediliyor…" : orderStatusState?.text}
          </p>
          <p className="mt-8 text-sm leading-relaxed text-ink/60">
            Siparişlerinizin durumunu{" "}
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
