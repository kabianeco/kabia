import { z } from "zod"

/**
 * One password rule for every form and server schema: registration, reset and
 * the signed-in change. Match Supabase (Authentication → Policies → Minimum
 * password length = 8). The upper bound is GoTrue's bcrypt input limit.
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

export const PASSWORD_RULE_TEXT = `En az ${PASSWORD_MIN_LENGTH} karakter`
export const PASSWORD_TOO_SHORT = `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`
export const PASSWORD_TOO_LONG = `Şifre en fazla ${PASSWORD_MAX_LENGTH} karakter olabilir.`

export const newPasswordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_TOO_LONG)

export type PasswordStrength = "empty" | "short" | "weak" | "fair" | "good"

/**
 * Guidance only — never an extra server rule. Length does most of the work;
 * mixing character kinds helps a little; a single repeated character or a
 * plain run of digits is weak whatever its length.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "empty"
  if (password.length < PASSWORD_MIN_LENGTH) return "short"
  if (/^(.)\1+$/.test(password) || /^[0-9]+$/.test(password)) return "weak"
  const kinds = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /[0-9]/, /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/].filter((re) => re.test(password)).length
  if (password.length >= 14 || (password.length >= 11 && kinds >= 2) || kinds >= 3) return "good"
  if (password.length >= 10 || kinds >= 2) return "fair"
  return "weak"
}

export const STRENGTH_TEXT: Record<PasswordStrength, string> = {
  empty: PASSWORD_RULE_TEXT,
  short: PASSWORD_RULE_TEXT,
  weak: "Zayıf — daha uzun bir şifre seçin",
  fair: "Orta",
  good: "İyi",
}
