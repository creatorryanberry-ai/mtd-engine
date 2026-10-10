const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function isoWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function clampMonthDay(year: number, month: number, dayOfMonth: number): string {
  const clamped = Math.min(dayOfMonth, daysInUtcMonth(year, month))
  const monthText = String(month).padStart(2, '0')
  const dayText = String(clamped).padStart(2, '0')
  return `${year}-${monthText}-${dayText}`
}

export function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right)
}

export function eachIsoDateInclusive(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return []

  const dates: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    dates.push(cursor)
    cursor = shiftIsoDate(cursor, 1)
  }
  return dates
}

export function uniqueSortedIsoDates(dates: string[]): string[] {
  return [...new Set(dates.filter(isIsoDate))].sort(compareIsoDates)
}

export function todayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfIsoWeek(isoDate: string): string {
  return shiftIsoDate(isoDate, 1 - isoWeekday(isoDate))
}

export function isoWeekDates(isoDate: string): string[] {
  const start = startOfIsoWeek(isoDate)
  return eachIsoDateInclusive(start, shiftIsoDate(start, 6))
}

export function monthDates(year: number, month: number): string[] {
  const start = clampMonthDay(year, month, 1)
  const end = clampMonthDay(year, month, 31)
  return eachIsoDateInclusive(start, end)
}

export function monthCalendarCells(year: number, month: number): Array<string | null> {
  const first = clampMonthDay(year, month, 1)
  const leading = isoWeekday(first) - 1
  const days = daysInUtcMonth(year, month)
  const cells: Array<string | null> = []
  for (let index = 0; index < leading; index += 1) cells.push(null)
  for (let day = 1; day <= days; day += 1) cells.push(clampMonthDay(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
