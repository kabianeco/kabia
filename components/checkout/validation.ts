import type { PaymentData } from "./types"

export function isPaymentValid(data: PaymentData): boolean {
  if (data.method === "cod") return true
  const digits = data.cardNumber.replace(/\s/g, "")
  const cardNameValid = data.cardName.trim().length > 1
  const cardNumberValid = /^\d{16}$/.test(digits)
  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(data.expiry)
  const expiryValid = !!expiryMatch && Number(expiryMatch[1]) >= 1 && Number(expiryMatch[1]) <= 12
  const cvvValid = /^\d{3}$/.test(data.cvv)
  return cardNameValid && cardNumberValid && expiryValid && cvvValid
}

export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
}

export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function formatCVV(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 3)
}

export function maskedCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\s/g, "")
  const last4 = digits.slice(-4)
  return `•••• •••• •••• ${last4 || "••••"}`
}
