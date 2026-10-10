import { isoWeekday, shiftIsoDate } from '~/features/mileage/utils/isoDates'

function easterSundayIso(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const monthText = String(month).padStart(2, '0')
  const dayText = String(day).padStart(2, '0')
  return `${year}-${monthText}-${dayText}`
}

function firstMondayOfMonth(year: number, month: number): string {
  const monthText = String(month).padStart(2, '0')
  const first = `${year}-${monthText}-01`
  const weekday = isoWeekday(first)
  const offset = weekday === 1 ? 0 : (8 - weekday) % 7
  return shiftIsoDate(first, offset)
}

function lastMondayOfMonth(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthText = String(month).padStart(2, '0')
  const last = `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`
  const weekday = isoWeekday(last)
  const offset = weekday === 1 ? 0 : weekday - 1
  return shiftIsoDate(last, -offset)
}

export function getEnglandWalesBankHolidays(year: number): string[] {
  const easter = easterSundayIso(year)
  const actual = [
    `${year}-01-01`,
    shiftIsoDate(easter, -2),
    shiftIsoDate(easter, 1),
    firstMondayOfMonth(year, 5),
    lastMondayOfMonth(year, 5),
    lastMondayOfMonth(year, 8),
    `${year}-12-25`,
    `${year}-12-26`,
  ]

  const weekdays = actual.filter((date) => isoWeekday(date) <= 5)
  const weekends = actual.filter((date) => isoWeekday(date) > 5)
  const used = new Set(weekdays)
  const observed = [...weekdays]

  for (const date of weekends) {
    let candidate = shiftIsoDate(date, isoWeekday(date) === 6 ? 2 : 1)
    while (used.has(candidate) || isoWeekday(candidate) > 5) {
      candidate = shiftIsoDate(candidate, 1)
    }
    used.add(candidate)
    observed.push(candidate)
  }

  return observed.sort()
}

export function getEnglandWalesBankHolidaysInRange(
  startDate: string,
  endDate: string,
): string[] {
  const startYear = Number.parseInt(startDate.slice(0, 4), 10)
  const endYear = Number.parseInt(endDate.slice(0, 4), 10)
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || startYear > endYear) {
    return []
  }

  const holidays: string[] = []
  for (let year = startYear; year <= endYear; year += 1) {
    for (const date of getEnglandWalesBankHolidays(year)) {
      if (date >= startDate && date <= endDate) holidays.push(date)
    }
  }
  return holidays
}
