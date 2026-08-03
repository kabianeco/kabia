export function formatPostDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} dk okuma`
}
