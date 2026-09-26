// Müşteri numarası: KE-###### (altı rastgele rakam, sıralı değil).
// Pure modül: database-free test edilebilir. Üretim ve benzersizlik
// veritabanında (generate_customer_number + UNIQUE); burası yalnızca biçim.

export const CUSTOMER_NUMBER_PREFIX = "KE-";

const CUSTOMER_NUMBER_RE = /^KE-[0-9]{6}$/;

/** Biçim denetimi: tam olarak KE-###### mı? */
export function isValidCustomerNumber(value: unknown): value is string {
  return typeof value === "string" && CUSTOMER_NUMBER_RE.test(value);
}

/**
 * Arama girdisini normalize eder: kırp, öneki büyüt, yalnızca biçim
 * tutarsa döndür. Boş/geçersiz girdi null verir (o zaman numarayla arama yok).
 */
export function normalizeCustomerNumberSearch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "") return null;
  // "KE" yazıp rakam girmemiş kullanıcı için öneki tamamlama.
  const candidate = trimmed.startsWith(CUSTOMER_NUMBER_PREFIX)
    ? trimmed
    : /^KE?$/.test(trimmed)
      ? CUSTOMER_NUMBER_PREFIX
      : trimmed;
  // Kısmi numaraları da aranabilir kıl: en az "KE-" + 2 rakam.
  if (/^KE-[0-9]{2,6}$/.test(candidate)) return candidate;
  return null;
}
