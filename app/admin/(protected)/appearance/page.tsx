import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { PageHeader, InlineAlert } from "@/components/admin/ui/surfaces"
import {
  getThemeSettingsRow,
  listThemeRevisions,
  type ThemeRevisionRow,
} from "@/lib/theme-settings"
import { AppearanceEditor } from "./appearance-editor"

export const metadata: Metadata = {
  title: "Görünüm",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * The appearance editor route. A server component that loads the singleton
 * theme row (published + draft) and the first page of revisions through the
 * administrator's session, then passes plain typed props to the client editor.
 *
 * Guarded by `manageTheme` (admin + super_admin). Every mutation re-checks the
 * same permission inside its server action, and the database RPCs re-derive
 * the actor from `auth.uid()` — so neither the layout nor this page is the
 * security boundary on its own.
 */
export default async function AppearancePage() {
  const { supabase } = await adminPageContext("manageTheme")

  let row
  try {
    row = await getThemeSettingsRow(supabase)
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Görünüm"
          description="Kontrollü tema motoru. Şekil preseti, tipografi ve ince ayar."
        />
        <InlineAlert tone="danger">
          Tema ayarları şu anda yüklenemiyor. Oturumunuz ve mevcut sayfa korunuyor;
          daha sonra yeniden deneyebilirsiniz.
        </InlineAlert>
      </div>
    )
  }
  if (!row) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Görünüm"
          description="Kontrollü tema motoru. Şekil preseti, tipografi ve ince ayar."
        />
        <InlineAlert tone="warning">
          Tema ayarları bulunamadı. Veritabanı göçünün uygulandığından emin olun.
        </InlineAlert>
      </div>
    )
  }

  let revisions: ThemeRevisionRow[] = []
  let revisionsUnavailable = false
  try {
    ;({ rows: revisions } = await listThemeRevisions(supabase, 1, 10))
  } catch {
    revisionsUnavailable = true
  }

  return (
    <>
      <PageHeader
        title="Görünüm"
        description="Kontrollü tema motoru. Şekil preseti, tipografi ve ince ayar. Değişiklikler taslak olarak kaydedilir ve yayınlandığında mağazaya yansır."
      />
      {revisionsUnavailable && (
        <div className="mb-6">
          <InlineAlert tone="warning">
            Sürüm geçmişi şu anda yüklenemiyor. Taslak ve yayın ayarlarınız etkilenmedi.
          </InlineAlert>
        </div>
      )}
      <AppearanceEditor
        publishedConfig={row.publishedConfig}
        draftConfig={row.draftConfig}
        publishedVersion={row.publishedVersion}
        revisions={revisions}
      />
    </>
  )
}
