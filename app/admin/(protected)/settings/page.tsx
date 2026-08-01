import type { Metadata } from "next"
import { adminContext } from "@/lib/admin/auth"
import { loadSettingsByGroup } from "@/lib/admin/queries/settings"
import { can } from "@/lib/admin/roles"
import { EmptyState, InlineAlert, PageHeader } from "@/components/admin/ui/surfaces"
import { SettingsGroupForm } from "./settings-form"

export const metadata: Metadata = { title: "Ayarlar" }
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const { session, supabase } = await adminContext("manageSettings")
  const groups = await loadSettingsByGroup(supabase)
  const canEditSensitive = can(session.role, "manageSensitiveSettings")

  const hasAny = Object.keys(groups).length > 0

  return (
    <>
      <PageHeader
        title="Ayarlar"
        description="Buradaki her ayar mağazanın gerçek davranışını değiştirir. Kaydedilen değerler herkese açık siteye anında yansır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Ayarlar" }]}
      />

      {!canEditSensitive && (
        <div className="mb-6">
          <InlineAlert tone="info">
            Mağazanın açık/kapalı durumu ve sipariş alımı gibi hassas ayarlar yalnızca
            süper yöneticiler tarafından değiştirilebilir. Bu ayarları görebilir, ancak
            düzenleyemezsiniz.
          </InlineAlert>
        </div>
      )}

      {!hasAny ? (
        <EmptyState
          title="Ayar bulunamadı"
          description="Ayar tablosu okunamadı. Sayfayı yenilemeyi deneyin."
        />
      ) : (
        <div className="space-y-6">
          <SettingsGroupForm
            group="general"
            title="Genel"
            description="Mağaza kimliği ve destek iletişim bilgileri. Bu değerler mağaza altbilgisinde gösterilir."
            settings={groups.general ?? []}
            canEditSensitive={canEditSensitive}
          />

          <SettingsGroupForm
            group="store"
            title="Mağaza durumu"
            description="Sipariş alımı kapatıldığında ödeme adımı veritabanı düzeyinde reddedilir — yalnızca arayüzde gizlenmez."
            settings={groups.store ?? []}
            canEditSensitive={canEditSensitive}
            longFields={["maintenance_message"]}
          />

          <SettingsGroupForm
            group="shipping"
            title="Kargo"
            description="Ücretsiz kargo limiti ve sabit kargo ücreti, sipariş oluşturma fonksiyonu tarafından doğrudan kullanılır."
            settings={groups.shipping ?? []}
            canEditSensitive={canEditSensitive}
            longFields={["shipping_message"]}
          />

          <SettingsGroupForm
            group="inventory"
            title="Stok"
            description="Yeni ürünler için varsayılan kritik stok eşiği."
            settings={groups.inventory ?? []}
            canEditSensitive={canEditSensitive}
          />

          <SettingsGroupForm
            group="seo"
            title="SEO ve paylaşım"
            description="Mağazanın varsayılan başlığı, açıklaması ve sosyal paylaşım görseli."
            settings={groups.seo ?? []}
            canEditSensitive={canEditSensitive}
            longFields={["seo_default_description"]}
          />
        </div>
      )}
    </>
  )
}
