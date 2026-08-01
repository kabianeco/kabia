"use client";

import { Switch } from "@/components/ui/switch";
import {
  useNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notification-prefs";

const TOGGLES: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}[] = [
  {
    key: "campaignEmails",
    label: "Kampanya e-postaları",
    description: "Yeni hasat ve fırsatlardan e-posta ile haberdar olun.",
  },
  {
    key: "orderStatus",
    label: "Sipariş durumu",
    description: "Siparişiniz hazırlanırken ve kargoya verilirken bilgilendirilin.",
  },
  {
    key: "sms",
    label: "SMS bildirimleri",
    description: "Sipariş ve kargo güncellemelerini SMS ile alın.",
  },
  {
    key: "stockAlerts",
    label: "Stok uyarıları",
    description: "Favori ürünleriniz stoğa girdiğinde haber verelim.",
  },
];

export default function NotificationPreferencesPage() {
  const { prefs, setPref, hydrated } = useNotificationPrefs();

  if (!hydrated) {
    return (
      <div className="min-h-[40vh]" aria-busy="true">
        <span className="sr-only">Tercihleriniz yükleniyor</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl tracking-tight md:text-4xl">Bildirimler</h1>
      <p className="mt-6 text-sm leading-relaxed text-ink/60">
        Değişiklikler anında kaydedilir.
      </p>
      <div className="mt-10 border-t border-ink/10">
        {TOGGLES.map((toggle) => (
          <Switch
            key={toggle.key}
            label={toggle.label}
            description={toggle.description}
            checked={prefs[toggle.key]}
            onCheckedChange={(checked) => setPref(toggle.key, checked)}
          />
        ))}
      </div>
    </div>
  );
}
