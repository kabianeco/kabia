export type PaymentMethod = "cod"

export interface PaymentData {
  method: PaymentMethod
}

export const EMPTY_PAYMENT: PaymentData = {
  method: "cod",
}

export type StepId = "payment" | "review" | "confirmation"

export const STEP_ORDER: StepId[] = ["payment", "review", "confirmation"]

export const STEP_LABELS: Record<StepId, string> = {
  payment: "Ödeme",
  review: "Özet",
  confirmation: "Onay",
}
