import { toCisVoucherIsoDate } from '~/features/bankAccounts/utils/cisVoucher'

export type ParsedCisVoucherFields = {
  customer: string | null
  date: string | null
  gross: string | null
  tax: string | null
  net: string | null
}

const TITLE_LINE =
  /^(sub\s*-?\s*contractor\s+monthly\s+statement|construction\s+industry\s+scheme|subcontractor|contractor)$/i

const ADDRESS_LIKE =
  /\b(street|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|close|cl\.?|way|court|ct\.?|place|pl\.?|house|unit|floor)\b/i

const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i

const COMPANY_SUFFIX = /\b(ltd\.?|limited|plc|llp|inc\.?|corp\.?)\b/i

const GROSS_LABEL = /\bgross\s+amount\s+paid\b/i
const TAX_LABEL = /\b(?:cis\s+)?tax\s+deducted\b/i
const NET_LABEL = /\bamount\s+payable\b/i
const MONTH_ENDING_LABEL = /\bmonth\s+ending\b/i

const SKIP_CUSTOMER_LINE =
  /^(name|unique\s+taxpayer|nino|crn|higher\s+rate|verification|reference|employer|contractor.?s?\s+employer|statement\s+of\s+payment)/i

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toIsoDate(year: number, month: number, day: number) {
  if (year < 1990 || year > 2100) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const iso = `${year}-${pad2(month)}-${pad2(day)}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return iso
}

function expandTwoDigitYear(year: number) {
  return year >= 70 ? 1900 + year : 2000 + year
}

function parseDateCandidate(raw: string): string | null {
  const value = raw.trim()

  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (match) {
    return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))
  }

  match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (match) {
    return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]))
  }

  match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/)
  if (match) {
    return toIsoDate(
      expandTwoDigitYear(Number(match[3])),
      Number(match[2]),
      Number(match[1]),
    )
  }

  return null
}

function extractDates(line: string) {
  const patterns = [
    /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/g,
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g,
  ]

  const dates: string[] = []
  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      const iso = parseDateCandidate(match[1]!)
      if (iso) dates.push(iso)
    }
  }
  return dates
}

function parseMoneyToken(raw: string) {
  const normalized = raw.replace(/[£$€\s]/g, '').replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null
  return value
}

function extractAmounts(line: string) {
  const amounts: number[] = []
  for (const match of line.matchAll(
    /[£$€]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\b/g,
  )) {
    const value = parseMoneyToken(match[0]!)
    if (value != null) amounts.push(value)
  }
  return amounts
}

function formatMoney(value: number) {
  return value.toFixed(2)
}

function looksLikeAddress(line: string) {
  if (POSTCODE.test(line)) return true
  if (/^\d/.test(line)) return true
  if (ADDRESS_LIKE.test(line) && /\d/.test(line)) return true
  return false
}

function isPlausibleCustomer(line: string) {
  if (line.length < 2 || line.length > 80) return false
  if (TITLE_LINE.test(line)) return false
  if (SKIP_CUSTOMER_LINE.test(line)) return false
  if (looksLikeAddress(line)) return false
  if (/@|www\.|https?:\/\//i.test(line)) return false
  if (extractAmounts(line).length > 0) return false
  if (extractDates(line).length > 0) return false
  if (!/[A-Za-z]/.test(line)) return false
  return true
}

/** contractor name sits above the address block near the top of the statement */
function pickCustomer(lines: string[]) {
  const start = lines.findIndex((line) => /monthly\s+statement/i.test(line))
  const searchFrom = start >= 0 ? start + 1 : 0

  for (let index = searchFrom; index < Math.min(lines.length, searchFrom + 12); index++) {
    const line = lines[index]!
    if (TITLE_LINE.test(line)) continue
    if (MONTH_ENDING_LABEL.test(line)) break
    if (/subcontractor/i.test(line) && !COMPANY_SUFFIX.test(line)) break
    if (looksLikeAddress(line)) break
    if (!isPlausibleCustomer(line)) continue
    return line
  }

  // fallback: first company-suffixed line near the top
  for (const line of lines.slice(0, 16)) {
    if (COMPANY_SUFFIX.test(line) && isPlausibleCustomer(line)) return line
  }

  return null
}

function pickLabeledAmount(lines: string[], label: RegExp) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (!label.test(line)) continue

    const amounts = extractAmounts(line)
    if (amounts.length > 0) return amounts[amounts.length - 1]!

    const next = lines[index + 1]
    if (next) {
      const nextAmounts = extractAmounts(next)
      if (nextAmounts.length > 0) return nextAmounts[0]!
    }
  }

  return null
}

function pickMonthEndingDate(lines: string[]) {
  for (const line of lines) {
    if (!MONTH_ENDING_LABEL.test(line)) continue
    const dates = extractDates(line)
    if (dates[0]) return dates[0]
  }

  for (let index = 0; index < lines.length; index++) {
    if (!MONTH_ENDING_LABEL.test(lines[index]!)) continue
    const next = lines[index + 1]
    if (!next) continue
    const dates = extractDates(next)
    if (dates[0]) return dates[0]
  }

  return null
}

function toVoucherDate(iso: string | null) {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  return toCisVoucherIsoDate(Number(match[1]), Number(match[2]))
}

export function parseCisVoucherText(text: string): ParsedCisVoucherFields {
  const lines = normalizeLines(text)
  if (lines.length === 0) {
    return {
      customer: null,
      date: null,
      gross: null,
      tax: null,
      net: null,
    }
  }

  const grossValue = pickLabeledAmount(lines, GROSS_LABEL)
  const taxValue = pickLabeledAmount(lines, TAX_LABEL)
  const netValue = pickLabeledAmount(lines, NET_LABEL)

  return {
    customer: pickCustomer(lines),
    date: toVoucherDate(pickMonthEndingDate(lines)),
    gross: grossValue == null ? null : formatMoney(grossValue),
    tax: taxValue == null ? null : formatMoney(taxValue),
    net: netValue == null ? null : formatMoney(netValue),
  }
}
