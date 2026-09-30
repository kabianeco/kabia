import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { logQueryError } from "@/lib/admin/errors"
import { pickString } from "@/lib/admin/url"
import { quoteOriginal } from "@/lib/email/compose"
import { bareAddress, type EmailRow } from "@/lib/email/rows"
import { replySubject } from "@/lib/email/threading"
import { PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { ComposeForm } from "../compose-form"

export const metadata: Metadata = { title: "Yeni e-posta" }
export const dynamic = "force-dynamic"

/**
 * Oluşturma ekranı. Üç giriş yolu:
 *   - boş (sıfırdan),
 *   - `?yanit=<ileti>` (+ `&tumune=1`): alıcı/konu/alıntı hazır gelir,
 *   - `?kime=<adres>&konu=<metin>`: iletişim-formu ekranındaki
 *     "E-posta ile yanıtla" buraya düşer.
 */
export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageInbox")
  const params = await searchParams

  const replyToId = pickString(params, "yanit", 40)
  const replyAll = pickString(params, "tumune") === "1"
  const toHint = pickString(params, "kime", 254)
  const subjectHint = pickString(params, "konu", 200)

  let defaults = { to: "", cc: "", subject: "", body: "", replyToEmailId: undefined as string | undefined, replyAll: false }
  let heading = "Yeni e-posta"
  let description = "Marka adresinden gönderilir; gönderilenler konuşmasında saklanır."

  if (replyToId) {
    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("id", replyToId)
      .maybeSingle()
    if (error) logQueryError("inbox:replyTarget", error)
    const original = data as EmailRow | null
    if (original) {
      const fromValue = process.env.RESEND_FROM ?? ""
      const own = new Set(
        [bareAddress(fromValue), ...original.to_addresses].filter((a): a is string => Boolean(a)).map((a) => a.toLowerCase()),
      )
      const to = original.from_address.toLowerCase()
      const cc = replyAll
        ? [...original.cc_addresses, ...original.to_addresses]
            .map((a) => a.toLowerCase())
            .filter((address, index, all) => !own.has(address) && address !== to && all.indexOf(address) === index)
            .slice(0, 20)
        : []
      const quoted = original.body_text
        ? `\n\n${quoteOriginal({ from: original.from_address, date: original.received_at ?? original.created_at, text: original.body_text.slice(0, 5000) })}`
        : ""
      defaults = {
        to,
        cc: cc.join(", "),
        subject: replySubject(original.subject),
        body: quoted.trimStart(),
        replyToEmailId: original.id,
        replyAll,
      }
      heading = replyAll ? "Tümünü yanıtla" : "Yanıtla"
      description = `“${original.subject || "(konusuz)"}” iletisine yanıt — aynı konuşmada gider.`
    }
  } else if (toHint) {
    defaults = {
      to: toHint.toLowerCase(),
      cc: "",
      subject: subjectHint ?? "",
      body: "",
      replyToEmailId: undefined,
      replyAll: false,
    }
  }

  return (
    <>
      <PageHeader
        title={heading}
        description={description}
        breadcrumbs={[{ label: "E-posta", href: "/admin/eposta" }, { label: heading }]}
      />
      <Panel>
        <ComposeForm defaults={defaults} />
      </Panel>
    </>
  )
}
