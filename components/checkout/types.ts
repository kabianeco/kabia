export type PaymentMethod = "card" | "cod"

export interface PaymentData {
  method: PaymentMethod
  cardName: string
  cardNumber: string // formatted, spaces every 4 digits
  expiry: string // MM/YY
  cvv: string
}

export const EMPTY_PAYMENT: PaymentData = {
  method: "card",
  cardName: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
}

export type StepId = "payment" | "review" | "confirmation"

export const STEP_ORDER: StepId[] = ["payment", "review", "confirmation"]

export const STEP_LABELS: Record<StepId, string> = {
  payment: "Ödeme",
  review: "Özet",
  confirmation: "Onay",
}
