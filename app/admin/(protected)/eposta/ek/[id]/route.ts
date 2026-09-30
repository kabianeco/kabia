import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { requirePermission } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { EmailAttachmentRow } from "@/lib/email/rows"

/**
 * Ek indirme: yalnızca yetkili yönetici, yalnızca imzalı URL'ye yönlendirme.
 *
 * Dosya baytı bu rotadan akmaz; Supabase'in kısa ömürlü (5 dk) imzalı URL'sine
 * 302 yapılır. Ekler asla satır içi (inline) gösterilmez — indirme zorlanır.
 */

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requirePermission("manageInbox")
  } catch {
    return new Response("Yetkisiz.", { status: 403 })
  }

  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("email_attachments")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return new Response("Bulunamadı.", { status: 404 })

  const row = data as EmailAttachmentRow
  if (!row.storage_path) return new Response("Ek indirilemiyor.", { status: 404 })

  const { data: signed, error: signError } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 300, { download: row.filename })
  if (signError || !signed?.signedUrl) return new Response("İmza üretilemedi.", { status: 502 })

  redirect(signed.signedUrl)
}
