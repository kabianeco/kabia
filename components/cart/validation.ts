const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s+()]{10,}$/

export function isContactValid(contact: { fullName: string; email: string; phone: string }): boolean {
  return (
    contact.fullName.trim().length > 1 &&
    EMAIL_RE.test(contact.email.trim()) &&
    PHONE_RE.test(contact.phone.trim())
  )
}

export interface NewAddressFields {
  label: string
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  postalCode: string
}

export function isNewAddressValid(fields: NewAddressFields): boolean {
  return (
    fields.recipientName.trim().length > 1 &&
    PHONE_RE.test(fields.phone.trim()) &&
    fields.addressLine1.trim().length > 3 &&
    fields.city.trim().length > 1 &&
    fields.district.trim().length > 1 &&
    fields.postalCode.trim().length >= 4
  )
}

export const EMPTY_NEW_ADDRESS: NewAddressFields = {
  label: "",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  postalCode: "",
}
