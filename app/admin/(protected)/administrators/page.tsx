import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { hasServiceRoleKey } from "@/lib/supabase/admin"
import { loadEmailsFor } from "@/lib/admin/queries/customers"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formatDate, formatDateTime } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import type { AdminRole } from "@/lib/admin/roles"
import { EmptyState, ErrorState, InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { RecordCard, RecordField, RecordList, Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"
import { RoleTag } from "@/components/admin/ui/status"
import { CreateAdministratorForm, RoleControls } from "./admin-controls"

export const metadata: Metadata = { title: "Yöneticiler" }
export const dynamic = "force-dynamic"

/**
 * Super-admin only. The route group's layout has already confirmed an
 * administrative role; `adminPageContext("manageAdministrators")` narrows that to
 * super_admin and throws otherwise, and every action on this page repeats the
 * check independently.
 */
export default async function AdministratorsPage() {
  const { session, supabase } = await adminPageContext("manageAdministrators")

  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role, is_active, must_change_password, created_at, updated_at")
    .in("role", ["admin", "super_admin"])
    .order("role", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) logQueryError("administrators:list", error)

  const roles = (data ?? []) as {
    user_id: string
    role: AdminRole
    is_active: boolean
    must_change_password: boolean
    created_at: string
    updated_at: string
  }[]

  const userIds = roles.map((row) => row.user_id)

  const [profilesRes, emails] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    loadEmailsFor(userIds),
  ])

  const names = new Map(
    ((profilesRes.data ?? []) as { id: string; full_name: string }[]).map((row) => [
      row.id,
      row.full_name,
    ]),
  )

  // Last sign-in is auth-only data; absent without a service-role key.
  const lastSignIn = new Map<string, string | null>()
  if (hasServiceRoleKey() && userIds.length > 0) {
    try {
      const admin = createSupabaseAdminClient()
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      for (const user of list?.users ?? []) {
        if (userIds.includes(user.id)) lastSignIn.set(user.id, user.last_sign_in_at ?? null)
      }
    } catch (authError) {
      logQueryError("administrators:lastSignIn", authError)
    }
  }

  const activeSuperAdmins = roles.filter((row) => row.role === "super_admin" && row.is_active)
  const lastSuperAdminId =
    activeSuperAdmins.length === 1 ? activeSuperAdmins[0].user_id : null

  return (
    <>
      <PageHeader
        title="Yöneticiler"
        description="Yönetici hesapları, rolleri ve erişim durumu. Bu sayfa yalnızca süper yöneticilere açıktır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Yöneticiler" }]}
      />

      <div className="mb-6">
        <InlineAlert tone="info">
          Son aktif süper yöneticinin rolü düşürülemez veya yetkisi kaldırılamaz. Bu kural
          veritabanı düzeyinde uygulanır — arayüz üzerinden atlatılamaz.
        </InlineAlert>
      </div>

      <div className="space-y-6">
        <CreateAdministratorForm serviceKeyAvailable={hasServiceRoleKey()} />

        <Panel title="Yönetici listesi" bodyClassName="px-0 py-0 md:px-0">
          <div className="px-4 py-4 md:px-5">
            {error ? (
              <ErrorState description="Yönetici listesi alınamadı." />
            ) : roles.length === 0 ? (
              <EmptyState
                title="Henüz yönetici yok"
                description="Bootstrap betiği çalıştırıldığında ilk süper yönetici burada görünecek."
              />
            ) : (
              <>
                <TableScroll className="hidden md:block">
                  <Table caption="Yönetici listesi">
                    <thead>
                      <tr>
                        <Th>Yönetici</Th>
                        <Th>E-posta</Th>
                        <Th>Rol</Th>
                        <Th>Eklendi</Th>
                        <Th>Son giriş</Th>
                        <Th align="right">
                          <span className="sr-only">İşlemler</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((row) => {
                        const displayName =
                          names.get(row.user_id) || emails.get(row.user_id) || "Yönetici"
                        const isSelf = row.user_id === session.userId
                        return (
                          <Tr key={row.user_id}>
                            <Td>
                              <span className="font-medium text-ink">{displayName}</span>
                              {isSelf && (
                                <span className="label ml-2 text-brand">Siz</span>
                              )}
                              {row.must_change_password && (
                                <span className="mt-0.5 block text-xs text-shell">
                                  Parola değişikliği bekliyor
                                </span>
                              )}
                            </Td>
                            <Td>
                              <span className="break-all text-xs text-ink/70">
                                {emails.get(row.user_id) ?? "—"}
                              </span>
                            </Td>
                            <Td>
                              <RoleTag role={row.role} active={row.is_active} />
                            </Td>
                            <Td>{formatDate(row.created_at)}</Td>
                            <Td>
                              {lastSignIn.get(row.user_id)
                                ? formatDateTime(lastSignIn.get(row.user_id)!)
                                : "—"}
                            </Td>
                            <Td align="right">
                              <RoleControls
                                userId={row.user_id}
                                displayName={displayName}
                                role={row.role}
                                isActive={row.is_active}
                                isSelf={isSelf}
                                isLastSuperAdmin={row.user_id === lastSuperAdminId}
                              />
                            </Td>
                          </Tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </TableScroll>

                <RecordList>
                  {roles.map((row) => {
                    const displayName =
                      names.get(row.user_id) || emails.get(row.user_id) || "Yönetici"
                    const isSelf = row.user_id === session.userId
                    return (
                      <RecordCard
                        key={row.user_id}
                        title={displayName}
                        meta={emails.get(row.user_id) ?? undefined}
                        actions={
                          <RoleControls
                            userId={row.user_id}
                            displayName={displayName}
                            role={row.role}
                            isActive={row.is_active}
                            isSelf={isSelf}
                            isLastSuperAdmin={row.user_id === lastSuperAdminId}
                          />
                        }
                      >
                        <RecordField label="Rol">
                          <RoleTag role={row.role} active={row.is_active} />
                        </RecordField>
                        <RecordField label="Eklendi">{formatDate(row.created_at)}</RecordField>
                      </RecordCard>
                    )
                  })}
                </RecordList>
              </>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}
