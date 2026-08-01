"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  changeAdministratorRoleAction,
  createAdministratorAction,
  setAdministratorStateAction,
} from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/roles"
import {
  AdminInput,
  AdminSelect,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import { InlineAlert, Panel } from "@/components/admin/ui/surfaces"

export function CreateAdministratorForm({ serviceKeyAvailable }: { serviceKeyAvailable: boolean }) {
  const [state, formAction] = useActionState(createAdministratorAction, ACTION_IDLE as never)
  const router = useRouter()
  const result = state as {
    ok: boolean
    message?: string
    warning?: string
    fieldErrors?: Record<string, string>
    temporaryPassword?: string
    createdEmail?: string
  }
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (result.ok) router.refresh()
  }, [result.ok, router])

  return (
    <Panel
      title="Yönetici ekle"
      description="Yeni hesap oluşturulur, rolü atanır ve ilk girişte parola değiştirmesi zorunlu kılınır."
    >
      {!serviceKeyAvailable && (
        <div className="mb-5">
          <InlineAlert tone="warning">
            Yönetici oluşturmak Supabase Auth Admin API&apos;sini gerektirir. Sunucu ortamında{" "}
            <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            tanımlanmadığı için bu form devre dışı. Mevcut yöneticilerin rolleri yine de
            değiştirilebilir.
          </InlineAlert>
        </div>
      )}

      {result.temporaryPassword && !acknowledged && (
        <div className="mb-5 rounded-[4px] border border-shell/50 bg-shell/10 p-4">
          <p className="label text-olive">Geçici parola — yalnızca bir kez gösterilir</p>
          <p className="mt-2 text-sm text-ink/75">
            <strong className="text-ink">{result.createdEmail}</strong> hesabı için geçici
            parola:
          </p>
          <p className="mt-2 select-all break-all rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 font-mono text-sm text-ink">
            {result.temporaryPassword}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink/55">
            Bu parola hiçbir yerde saklanmaz ve sayfa yenilendiğinde kaybolur. Güvenli bir
            kanaldan iletin; kullanıcı ilk girişte kendi parolasını belirlemek zorundadır.
          </p>
          <button
            type="button"
            onClick={() => setAcknowledged(true)}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
          >
            Kaydettim, gizle
          </button>
        </div>
      )}

      <form action={formAction} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-3">
          <AdminInput
            label="Ad soyad"
            name="full_name"
            required
            error={result.fieldErrors?.full_name}
            disabled={!serviceKeyAvailable}
          />
          <AdminInput
            label="E-posta"
            name="email"
            type="email"
            required
            error={result.fieldErrors?.email}
            disabled={!serviceKeyAvailable}
          />
          <AdminSelect
            label="Rol"
            name="role"
            required
            defaultValue="admin"
            error={result.fieldErrors?.role}
            disabled={!serviceKeyAvailable}
          >
            <option value="admin">{ROLE_LABELS.admin}</option>
            <option value="super_admin">{ROLE_LABELS.super_admin}</option>
          </AdminSelect>
        </div>

        <FormMessage state={result} />

        <SubmitButton disabled={!serviceKeyAvailable} pendingLabel="Oluşturuluyor…">
          Yönetici oluştur
        </SubmitButton>
      </form>
    </Panel>
  )
}

export function RoleControls({
  userId,
  displayName,
  role,
  isActive,
  isSelf,
  isLastSuperAdmin,
}: {
  userId: string
  displayName: string
  role: AdminRole
  isActive: boolean
  isSelf: boolean
  isLastSuperAdmin: boolean
}) {
  const [roleState, roleAction] = useActionState(changeAdministratorRoleAction, ACTION_IDLE)
  const [stateState, stateAction] = useActionState(setAdministratorStateAction, ACTION_IDLE)
  const router = useRouter()

  useEffect(() => {
    if (roleState.ok || stateState.ok) router.refresh()
  }, [roleState.ok, stateState.ok, router])

  const nextRole: AdminRole = role === "super_admin" ? "admin" : "super_admin"
  const blockedReason = isLastSuperAdmin
    ? "Son aktif süper yönetici olduğu için rolü düşürülemez veya yetkisi kaldırılamaz."
    : null

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {!blockedReason && (
          <ConfirmAction
            trigger={`${ROLE_LABELS[nextRole]} yap`}
            triggerVariant="outline"
            tone={nextRole === "super_admin" ? "danger" : "primary"}
            title="Yönetici rolünü değiştir"
            description={
              nextRole === "super_admin" ? (
                <>
                  <p>
                    Süper yöneticiler başka yönetici oluşturabilir, rol değiştirebilir,
                    yetki kaldırabilir ve hassas ayarlara erişebilir.
                  </p>
                  <p className="mt-2">Bu yetkiyi yalnızca güvendiğiniz kişilere verin.</p>
                </>
              ) : (
                <p>
                  Bu kullanıcı artık yönetici oluşturamayacak, rol değiştiremeyecek ve
                  hassas ayarlara erişemeyecek.
                </p>
              )
            }
            entityName={`${displayName} · ${ROLE_LABELS[role]} → ${ROLE_LABELS[nextRole]}`}
            typedConfirmation={
              isSelf || nextRole === "super_admin" ? displayName : undefined
            }
            confirmLabel="Rolü değiştir"
            pendingLabel="Güncelleniyor…"
            action={roleAction}
            hiddenFields={{ user_id: userId, role: nextRole }}
          />
        )}

        {isActive ? (
          !blockedReason &&
          !isSelf && (
            <ConfirmAction
              trigger="Yetkiyi kaldır"
              triggerVariant="danger"
              title="Yönetici yetkisini kaldır"
              description="Kullanıcının yönetim paneline erişimi derhal sona erer ve açık oturumları sonlandırılır. Müşteri hesabı etkilenmez."
              entityName={displayName}
              typedConfirmation={displayName}
              confirmLabel="Yetkiyi kaldır"
              pendingLabel="Kaldırılıyor…"
              action={stateAction}
              hiddenFields={{ user_id: userId, is_active: "false" }}
            />
          )
        ) : (
          <ConfirmAction
            trigger="Yetkiyi geri ver"
            triggerVariant="outline"
            tone="primary"
            title="Yönetici yetkisini geri ver"
            description="Kullanıcı yönetim paneline yeniden erişebilecek."
            entityName={displayName}
            confirmLabel="Yetkiyi geri ver"
            pendingLabel="Veriliyor…"
            action={stateAction}
            hiddenFields={{ user_id: userId, is_active: "true" }}
          />
        )}
      </div>

      {blockedReason && <p className="text-right text-xs text-ink/45">{blockedReason}</p>}
      {isSelf && isActive && !blockedReason && (
        <p className="text-right text-xs text-ink/45">
          Kendi yetkinizi bu ekrandan kaldıramazsınız.
        </p>
      )}

      <div className="w-full max-w-xs">
        <FormMessage state={roleState.message ? roleState : stateState} />
      </div>
    </div>
  )
}
