"use server"

import { cookies } from "next/headers"
import {
  changeEmail,
  changePassword,
  deleteAccount,
  exportData,
  formObject,
  setMarketingConsent,
  signOutEverywhere,
  updateProfile,
  type AccountResult,
  type ExportResult,
} from "@/lib/account/handlers"
import {
  baseDeps,
  collectExport,
  deleteAuthUser,
  hasStaffRole,
  removeAccountContent,
  requestEmailChange,
  saveProfile,
  setMarketingConsent as setMarketingConsentRpc,
  signOutGlobal,
  updatePasswordWithProof,
  verifyPassword,
} from "@/lib/account/server-deps"
import { FLOW_COOKIES, flowCookieOptions, issueFlowMarker } from "@/lib/auth/flow-marker"
import type { ActionState } from "@/lib/admin/errors"

/**
 * Signed-in account actions. Validation, rate limiting (account_reauth /
 * account_update buckets) and the current-password proof live in
 * lib/account/handlers.ts; this file only supplies the real dependencies.
 * Messages are generic and never say whether another account exists.
 */

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<AccountResult> {
  const deps = await baseDeps()
  return changePassword(formObject(formData), { ...deps, updatePassword: updatePasswordWithProof })
}

export async function changeEmailAction(_prev: ActionState, formData: FormData): Promise<AccountResult> {
  const deps = await baseDeps()
  return changeEmail(formObject(formData), {
    ...deps,
    verifyPassword,
    requestEmailChange: (email) => requestEmailChange(deps.client, email),
  })
}

export async function signOutEverywhereAction(_prev: ActionState, formData: FormData): Promise<AccountResult> {
  const deps = await baseDeps()
  return signOutEverywhere(formObject(formData), {
    ...deps,
    verifyPassword,
    signOutGlobal: () => signOutGlobal(deps.client),
  })
}

export async function exportDataAction(_prev: ActionState, formData: FormData): Promise<ExportResult> {
  const deps = await baseDeps()
  return exportData(formObject(formData), {
    ...deps,
    verifyPassword,
    collect: (user) => collectExport(deps.client, user),
  })
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<AccountResult> {
  const deps = await baseDeps()
  const result = await deleteAccount(formObject(formData), {
    ...deps,
    verifyPassword,
    hasStaffRole,
    removeAccountContent,
    deleteAuthUser,
  })
  if (result.ok) {
    const cookieStore = await cookies()
    // The Auth user is gone; drop this browser's session cookies directly
    // (a sign-out call would need the deleted user's session to succeed).
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith("sb-")) cookieStore.delete(cookie.name)
    }
    cookieStore.set(FLOW_COOKIES.account_deleted.name, issueFlowMarker("account_deleted", "done"), flowCookieOptions("account_deleted"))
  }
  return result
}

export async function updateProfileAction(_prev: ActionState, formData: FormData) {
  const deps = await baseDeps()
  return updateProfile(formObject(formData), {
    ...deps,
    saveProfile: (userId, patch) => saveProfile(deps.client, userId, patch),
  })
}

export async function setMarketingConsentAction(_prev: ActionState, formData: FormData) {
  const deps = await baseDeps()
  return setMarketingConsent(formObject(formData), {
    ...deps,
    setMarketingConsent: (granted) => setMarketingConsentRpc(deps.client, granted),
  })
}
