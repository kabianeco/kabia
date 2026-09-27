/**
 * Saved-address identity (database-free, unit-tested).
 *
 * Two rows are "identical" when every user-visible field matches after
 * normalization: trim + collapse inner whitespace, case-fold city/district/
 * label, strip non-digits from phone, treat null/"" address_line2 and
 * postal_code as equal. is_default, id and created_at are not identity.
 */

export interface AddressLike {
  label: string
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string | null | undefined
  city: string
  district: string
  postalCode: string | null | undefined
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function cleanLower(value: string): string {
  return cleanText(value).toLocaleLowerCase("tr")
}

function cleanPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  // Turkish mobile: 0552… and 552… are the same number; compare without
  // leading trunk zeros so guest/server variants reuse instead of duplicating.
  return digits.replace(/^0+/, "")
}

function cleanOptional(value: string | null | undefined): string {
  if (value === null || value === undefined) return ""
  return cleanText(value)
}

export interface NormalizedAddress {
  label: string
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  postalCode: string
}

export function normalizeAddress(a: AddressLike): NormalizedAddress {
  return {
    label: cleanLower(a.label),
    recipientName: cleanText(a.recipientName),
    phone: cleanPhone(a.phone),
    addressLine1: cleanText(a.addressLine1),
    addressLine2: cleanOptional(a.addressLine2),
    city: cleanLower(a.city),
    district: cleanLower(a.district),
    postalCode: cleanOptional(a.postalCode),
  }
}

export function addressKey(n: NormalizedAddress): string {
  return [n.label, n.recipientName, n.phone, n.addressLine1, n.addressLine2, n.city, n.district, n.postalCode].join("\0")
}

export function isSameAddress(a: AddressLike, b: AddressLike): boolean {
  return addressKey(normalizeAddress(a)) === addressKey(normalizeAddress(b))
}

/** Keeps the first of each identical group, preserves order. */
export function dedupeAddresses<T extends AddressLike>(list: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of list) {
    const key = addressKey(normalizeAddress(item))
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
