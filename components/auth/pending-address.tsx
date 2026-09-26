"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { readPendingEmail } from "@/lib/auth/pending"
import { CODE_LENGTH } from "@/lib/auth/code"
import { routes } from "@/lib/site"

/** The address the confirmation went to, read once from this tab's session. */
export function usePendingEmail(): { email: string; ready: boolean } {
  const [state, setState] = useState({ email: "", ready: false })
  useEffect(() => {
    const read = setTimeout(() => setState({ email: readPendingEmail(), ready: true }), 0)
    return () => clearTimeout(read)
  }, [])
  return state
}

function Address({ email }: { email: string }) {
  return <span className="break-all text-ink">{email}</span>
}

/** Waiting screen: where the e-mail went, and nothing else. */
export function WaitingLead() {
  const { email } = usePendingEmail()
  return email ? (
    <>Doğrulama e-postasını <Address email={email} /> adresine gönderdik.</>
  ) : (
    <>Doğrulama e-postasını adresinize gönderdik.</>
  )
}

/** Code screen: the address in plain text, then a small "Adres yanlış mı?" link. */
export function CodeLead() {
  const { email } = usePendingEmail()
  return (
    <>
      {email ? (
        <><Address email={email} /> adresine gönderdiğimiz {CODE_LENGTH} haneli kodu girin.</>
      ) : (
        <>E-postanıza gönderdiğimiz {CODE_LENGTH} haneli kodu girin.</>
      )}{" "}
      <Link href={routes.register} className="whitespace-nowrap text-sm text-brand transition-colors duration-300 hover:text-forest">
        Adres yanlış mı?
      </Link>
    </>
  )
}
