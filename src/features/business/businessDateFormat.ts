const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UK_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/

export function formatBusinessDateUk(isoDate: string): string {
  if (!ISO_DATE_RE.test(isoDate)) return isoDate

  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function parseBusinessDateUk(ukDate: string): string | null {
  const trimmed = ukDate.trim()
  const match = UK_DATE_RE.exec(trimmed)
  if (!match) return null

  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  if (!isValidIsoDate(iso)) return null
  return iso
}

export function isValidIsoDate(isoDate: string): boolean {
  if (!ISO_DATE_RE.test(isoDate)) return false

  const [year, month, day] = isoDate.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export function isoToDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
