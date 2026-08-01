"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { administratorInviteSchema, fieldErrorsFrom, uuid } from "@/lib/admin/schemas"

/**
 * Administrator management. Every action here is super_admin only, checked
 * three times over: `requireSuperAdmin()` at the top, the
 * `user_roles_write_super_admin` RLS policy on the write, and — for the two
 * invariants that must hold even against direct SQL — the
 * `enforce_last_super_admin` trigger.
 *
 * The service-role client appears only where the Auth Admin API is genuinely
 * required: creating an auth user, and reading auth-only fields. It is never
 * used to sidestep RLS on `user_roles`; role writes go through the acting
 * administrator's own session so the policy is what authorises them.
 */

/** Cryptographically random, and comfortably above the policy floor. */
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const symbols = "!@#$%^&*-_=+"
  const bytes = new Uint32Array(20)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < 18; i++) out += alphabet[bytes[i] % alphabet.length]
  out += symbols[bytes[18] % symbols.length]
  out += String(bytes[19] % 10)
  return out
}

export interface CreateAdminState extends ActionState {
  /** Shown once, never persisted. Absent on every other outcome. */
  temporaryPassword?: string
  createdEmail?: string
}

export async function createAdministratorAction(
  _prev: CreateAdminState,
  formData: FormData,
): Promise<CreateAdminState> {
  try {
    const acting = await requireSuperAdmin()

    if (!hasServiceRoleKey()) {
      return {
        ok: false,
        message:
          "Yönetici oluşturmak için sunucu tarafı Supabase servis anahtarı gerekir. SUPABASE_SERVICE_ROLE_KEY yapılandırılmamış.",
      }
    }

    const parsed = administratorInviteSchema.safeParse({
      email: formData.get("email"),
      full_name: formData.get("full_name"),
      role: formData.get("role"),
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
    }

    const { email, full_name: fullName, role } = parsed.data
    const admin = createSupabaseAdminClient()
    const supabase = await createSupabaseServerClient()

    const temporaryPassword = generateTemporaryPassword()

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError || !created.user) {
      const message = createError?.message ?? ""
      if (/already/i.test(message) || /registered/i.test(message)) {
        return {
          ok: false,
          fieldErrors: {
            email:
              "Bu e-posta ile bir hesap zaten var. Mevcut hesabı yönetici yapmak için listeden rolünü değiştirin.",
          },
        }
      }
      return toActionState(createError, "createAdministrator:auth")
    }

    const newUserId = created.user.id

    // The handle_new_user trigger creates the profile row; make sure the name is
    // the one that was typed rather than the email stem.
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", newUserId)

    // Role assignment through the acting super_admin's session, so RLS decides.
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: newUserId,
      role,
      is_active: true,
      must_change_password: true,
      created_by: acting.userId,
      updated_by: acting.userId,
    })

    if (roleError) {
      // The auth user exists but has no role, which grants nothing. Say so
      // plainly rather than pretending the operation succeeded.
      return {
        ok: false,
        message:
          "Hesap oluşturuldu ancak rol atanamadı. Listeden bu kullanıcının rolünü elle atayın.",
      }
    }

    const audited = await logAdminAction(supabase, {
      action: "administrator.create",
      entityType: "administrator",
      entityId: newUserId,
      after: { role, is_active: true, full_name: fullName },
      metadata: { email },
    })

    revalidatePath("/admin/administrators")

    return {
      ok: true,
      message: "Yönetici oluşturuldu.",
      temporaryPassword,
      createdEmail: email,
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "createAdministrator")
  }
}

const roleChangeSchema = z.object({
  user_id: uuid,
  role: z.enum(["admin", "super_admin"], { message: "Geçersiz rol." }),
})

export async function changeAdministratorRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const acting = await requireSuperAdmin()
    const supabase = await createSupabaseServerClient()

    const parsed = roleChangeSchema.safeParse({
      user_id: formData.get("user_id"),
      role: formData.get("role"),
    })
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

    const { data: before, error: readError } = await supabase
      .from("user_roles")
      .select("user_id, role, is_active")
      .eq("user_id", parsed.data.user_id)
      .maybeSingle()

    if (readError) return toActionState(readError, "changeRole:read")
    if (!before) return { ok: false, message: "Yönetici kaydı bulunamadı." }
    if (before.role === parsed.data.role) return { ok: true, message: "Rol zaten bu değerde." }

    const { error } = await supabase
      .from("user_roles")
      .update({ role: parsed.data.role, updated_by: acting.userId })
      .eq("user_id", parsed.data.user_id)

    // The last-super-admin trigger raises a check_violation with a Turkish
    // message, which toActionState passes through as-is.
    if (error) return toActionState(error, "changeRole")

    const audited = await logAdminAction(supabase, {
      action: "administrator.role_change",
      entityType: "administrator",
      entityId: parsed.data.user_id,
      before: { role: before.role },
      after: { role: parsed.data.role },
      metadata: { self: parsed.data.user_id === acting.userId },
    })

    revalidatePath("/admin/administrators")
    return {
      ok: true,
      message: "Rol güncellendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "changeAdministratorRole")
  }
}

const stateSchema = z.object({
  user_id: uuid,
  is_active: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
})

export async function setAdministratorStateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const acting = await requireSuperAdmin()
    const supabase = await createSupabaseServerClient()

    const parsed = stateSchema.safeParse({
      user_id: formData.get("user_id"),
      is_active: formData.get("is_active"),
    })
    if (!parsed.success) return { ok: false, message: "Geçersiz istek." }

    // Self-lockout guard. The database stops the *last* super admin from being
    // removed; this stops a super admin removing themselves while others exist,
    // which the database has no reason to forbid but which is almost never what
    // was intended from this screen.
    if (parsed.data.user_id === acting.userId && !parsed.data.is_active) {
      return {
        ok: false,
        message:
          "Kendi yönetici yetkinizi bu ekrandan kaldıramazsınız. Başka bir süper yönetici bu işlemi yapmalı.",
      }
    }

    const { data: before } = await supabase
      .from("user_roles")
      .select("user_id, role, is_active")
      .eq("user_id", parsed.data.user_id)
      .maybeSingle()

    if (!before) return { ok: false, message: "Yönetici kaydı bulunamadı." }

    const { error } = await supabase
      .from("user_roles")
      .update({ is_active: parsed.data.is_active, updated_by: acting.userId })
      .eq("user_id", parsed.data.user_id)

    if (error) return toActionState(error, "setAdministratorState")

    // Revoking access should end existing sessions, not wait for a token to
    // expire. This needs the Auth Admin API; if it is unavailable the role row
    // still denies every request on the next navigation.
    let sessionWarning: string | undefined
    if (!parsed.data.is_active) {
      if (hasServiceRoleKey()) {
        const admin = createSupabaseAdminClient()
        const { error: signOutError } = await admin.auth.admin.signOut(parsed.data.user_id, "global")
        if (signOutError) {
          sessionWarning =
            "Yetki kaldırıldı, ancak mevcut oturum sonlandırılamadı. Erişim yine de bir sonraki istekte reddedilir."
        }
      } else {
        sessionWarning =
          "Yetki kaldırıldı. Servis anahtarı olmadığı için açık oturum sonlandırılamadı; erişim bir sonraki istekte reddedilir."
      }
    }

    const audited = await logAdminAction(supabase, {
      action: parsed.data.is_active ? "administrator.reactivate" : "administrator.deactivate",
      entityType: "administrator",
      entityId: parsed.data.user_id,
      before: { is_active: before.is_active, role: before.role },
      after: { is_active: parsed.data.is_active, role: before.role },
    })

    revalidatePath("/admin/administrators")

    return {
      ok: true,
      message: parsed.data.is_active ? "Yönetici yetkisi geri verildi." : "Yönetici yetkisi kaldırıldı.",
      warning: sessionWarning ?? (audited ? undefined : AUDIT_WARNING),
    }
  } catch (error) {
    return toActionState(error, "setAdministratorState")
  }
}
