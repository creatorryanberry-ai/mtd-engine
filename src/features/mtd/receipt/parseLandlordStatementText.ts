export type ParsedLandlordStatementFields = {
  lettingAgent: string | null
  date: string | null
  grossRents: string | null
  expenses: string | null
  vatOnExpenses: string | null
  netReceived: string | null
}

const emptyParsed: ParsedLandlordStatementFields = {
  lettingAgent: null,
  date: null,
  grossRents: null,
  expenses: null,
  vatOnExpenses: null,
  netReceived: null,
}

const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i
const ADDRESS_LIKE =
  /\b(street|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|close|cl\.?|way|court|ct\.?|place|pl\.?|view|crescent|house|unit|floor)\b/i
const COMPANY_SUFFIX = /\b(ltd\.?|limited|plc|llp|inc\.?|corp\.?)\b/i
const AGENT_HINT =
  /\b(residential|lettings?|estates?|properties|property|collection|agency|agents?|management|homes)\b/i
/** single-token brand fragments — often the second half of a logo (e.g. "Harris Shields" / "Collection") */
const GENERIC_AGENT_TOKEN =
  /^(collection|agency|agents?|management|lettings?|estates?|properties|property|homes|residential)$/i
const PERSON_PREFIX = /^(mr|mrs|ms|miss|dr|sir|mx)\b\.?\s/i

const STATEMENT_DATE_LABEL =
  /\b(?:statement(?:\s+date)?|date|landlord\s+statement\s+to|statement\s+to|period\s+(?:ending|ended|to)|month\s+(?:ending|ended))\b/i
const CLIENT_ACCOUNT = /^(.+?)\s+CLIENT\s+ACCOUNT\b/i
const EMAIL = /[a-z0-9._%+-]+@([a-z0-9-]+)\.(?:co\.uk|com|org|net|uk)\b/i
const PAYMENT_TO_LANDLORD = /\bpayment\s+to\s+landlord\b/i
const SUBTOTAL = /\bsub[\s-]*totals?\b/i
const BALANCE_PAID = /\b(?:balance|paid\s+on)\b/i
const OPENING_CLOSING = /\b(?:opening|closing)\s+balance\b/i
const DEDUCTIONS_HEADER = /\bdeductions?\b/i
const INCOME_HEADER = /\bincome\b/i
const VAT_HEADER = /\bvat\b/i
const TOTAL_HEADER = /\btotal\b/i
const PAYMENTS_HEADER = /\bpayments?\b/i
const RECEIPTS_HEADER = /\breceipts?\b/i

const SKIP_AGENT_LINE =
  /^(our\s+ref|ref(?:erence)?|statement|date|vat\s*no|description|income|deductions|payments|receipts|opening|closing|balance|paid|float|tel|phone|mobile|email|www\.|http|a\/n|s\/c)/i

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => collapseSpacedLetters(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** pdf text layers often emit "P a yment" — collapse runs of single letters */
function collapseSpacedLetters(value: string) {
  return value.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (match) =>
    match.replace(/\s+/g, ''),
  )
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

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
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

  match = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/)
  if (match) {
    const month = MONTHS[match[2]!.toLowerCase()]
    if (!month) return null
    const yearRaw = Number(match[3])
    const year = yearRaw < 100 ? expandTwoDigitYear(yearRaw) : yearRaw
    return toIsoDate(year, month, Number(match[1]))
  }

  return null
}

function extractDates(line: string) {
  const patterns = [
    /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/g,
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g,
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/g,
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
  // ocr often reads £0.00 as E0.00 or mixes euro signs
  const normalized = raw
    .replace(/^[£$€E]\s*/i, '')
    .replace(/[£$€\s]/g, '')
    .replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) return null
  return value
}

function extractAmounts(line: string) {
  const amounts: number[] = []
  for (const match of line.matchAll(
    /(?:[£$€E]\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\b/gi,
  )) {
    const value = parseMoneyToken(match[0]!)
    if (value != null) amounts.push(value)
  }
  return amounts
}

function formatMoney(value: number) {
  return value.toFixed(2)
}

function titleCaseCompany(raw: string) {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (/^(ltd|llp|plc)$/i.test(word)) {
        return word.toUpperCase() === 'LLP' || word.toUpperCase() === 'PLC'
          ? word.toUpperCase()
          : 'Ltd'
      }
      if (word.length <= 2 && word === word.toUpperCase()) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function looksLikeAddress(line: string) {
  if (POSTCODE.test(line)) return true
  if (/^\d/.test(line) && ADDRESS_LIKE.test(line)) return true
  if (ADDRESS_LIKE.test(line) && /\d/.test(line)) return true
  return false
}

function isRecipientName(line: string, nextLines: string[]) {
  if (PERSON_PREFIX.test(line)) return true
  // managing-agent brands often sit above their own office address
  if (AGENT_HINT.test(line)) return false

  const followedByAddress = nextLines
    .slice(0, 4)
    .some((next) => looksLikeAddress(next) || POSTCODE.test(next))
  if (!followedByAddress) return false
  // landlord recipient can be a company (e.g. RDP of Rotherham Ltd)
  if (COMPANY_SUFFIX.test(line)) return true
  return false
}

function humanizeEmailDomain(domain: string) {
  // harris-shieldscollection → harris shields collection
  let cleaned = domain
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(
      /([a-z])(collection|lettings?|residential|estates?|properties|agency|management|homes)\b/gi,
      '$1 $2',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return titleCaseCompany(cleaned)
}

function looksLikeContactNoise(line: string) {
  if (EMAIL.test(line) || line.includes('@')) return true
  if (/^www\./i.test(line) || /^https?:\/\//i.test(line)) return true
  if (/^(tel|phone|mobile|fax)\b/i.test(line)) return true
  // bare phone numbers in the header block
  if (/^\+?\d[\d\s().-]{6,}\d$/.test(line)) return true
  return false
}

function looksLikeAgentBrandPrefix(line: string) {
  if (!line || line.length < 2 || line.length > 60) return false
  if (SKIP_AGENT_LINE.test(line)) return false
  if (looksLikeContactNoise(line)) return false
  if (looksLikeAddress(line)) return false
  if (PERSON_PREFIX.test(line)) return false
  if (extractAmounts(line).length > 0) return false
  if (extractDates(line).length > 0) return false
  // brand prefixes are usually 1–4 title-ish words, not a sentence
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 4) return false
  return true
}

function cleanAgentLine(line: string) {
  return line.replace(/\s*[|•].*$/, '').trim()
}

function pickLettingAgent(lines: string[]) {
  for (const line of lines) {
    const client = line.match(CLIENT_ACCOUNT)
    if (client?.[1]) {
      return titleCaseCompany(client[1])
    }
  }

  for (let index = 0; index < Math.min(lines.length, 12); index++) {
    const line = lines[index]!
    if (SKIP_AGENT_LINE.test(line)) continue
    if (looksLikeContactNoise(line)) continue
    if (looksLikeAddress(line)) continue
    if (extractAmounts(line).length > 0) continue
    if (PERSON_PREFIX.test(line)) continue
    if (isRecipientName(line, lines.slice(index + 1))) continue

    if (GENERIC_AGENT_TOKEN.test(line.trim())) {
      const previous = index > 0 ? lines[index - 1]! : null
      if (previous && looksLikeAgentBrandPrefix(previous)) {
        return titleCaseCompany(`${cleanAgentLine(previous)} ${cleanAgentLine(line)}`)
      }
      // bare "Collection" / "Agency" is too weak — keep looking
      continue
    }

    if (AGENT_HINT.test(line) && line.length >= 4 && line.length <= 80) {
      return cleanAgentLine(line)
    }
    if (COMPANY_SUFFIX.test(line) && AGENT_HINT.test(line)) {
      return line
    }
  }

  for (const line of lines.slice(0, 20)) {
    const email = line.match(EMAIL)
    if (email?.[1] && !/^(gmail|hotmail|outlook|yahoo|icloud|me)$/i.test(email[1])) {
      return humanizeEmailDomain(email[1])
    }
  }

  return null
}

function pickStatementDate(lines: string[]) {
  let labeled: string | null = null
  let first: string | null = null

  for (const line of lines) {
    const dates = extractDates(line)
    if (dates.length === 0) continue
    if (!first) first = dates[0]!
    if (!labeled && STATEMENT_DATE_LABEL.test(line)) {
      labeled = dates[dates.length - 1]!
    }
  }

  return labeled ?? first
}

function amountsClose(left: number, right: number) {
  return Math.abs(left - right) < 0.02
}

function tryIncomeDeductionQuartet(amounts: number[]) {
  if (amounts.length < 4) return null
  const gross = amounts[0]!
  const expenses = amounts[1]!
  const vat = amounts[2]!
  const net = amounts[3]!
  if (gross <= 0) return null
  if (!amountsClose(gross - expenses - vat, net)) return null
  return { gross, expenses, vat, net }
}

/** ocr often shuffles the totals row — find assignment where gross - expenses - vat = net */
function assignIncomeDeductionQuartet(amounts: number[], preferredNet?: number | null) {
  if (amounts.length !== 4) return null

  const candidates: Array<{
    gross: number
    expenses: number
    vat: number
    net: number
  }> = []

  for (let netIndex = 0; netIndex < 4; netIndex++) {
    const net = amounts[netIndex]!
    const rest = amounts.filter((_, index) => index !== netIndex)
    for (let grossIndex = 0; grossIndex < 3; grossIndex++) {
      const gross = rest[grossIndex]!
      if (gross < net) continue
      const costs = rest.filter((_, index) => index !== grossIndex)
      const left = costs[0]!
      const right = costs[1]!
      if (!amountsClose(gross - left - right, net)) continue
      candidates.push({
        gross,
        expenses: Math.max(left, right),
        vat: Math.min(left, right),
        net,
      })
    }
  }

  if (candidates.length === 0) return null

  const preferred =
    preferredNet == null
      ? candidates
      : candidates.filter((candidate) => amountsClose(candidate.net, preferredNet))
  const pool = preferred.length > 0 ? preferred : candidates

  // prefer largest gross (income total), then largest net (paid to landlord), then smallest vat
  pool.sort(
    (left, right) =>
      right.gross - left.gross || right.net - left.net || left.vat - right.vat,
  )
  return pool[0]!
}

function amountsBeforeOpeningBalance(lines: string[]) {
  const openingIndex = lines.findIndex((line) => OPENING_CLOSING.test(line))
  if (openingIndex < 0) return []

  const collected: number[] = []
  for (let index = openingIndex - 1; index >= 0 && collected.length < 8; index--) {
    const amounts = extractAmounts(lines[index]!)
    if (amounts.length === 0) {
      if (collected.length > 0) break
      continue
    }
    collected.unshift(...amounts)
  }
  return collected
}

/** FlexResidential-style: Income | Deductions ex VAT | VAT | Total */
function pickIncomeDeductionsTotals(lines: string[]) {
  const preferredNet = pickBalanceNet(lines)

  let headerIndex = -1
  for (let index = 0; index < lines.length; index++) {
    const nearby = lines.slice(Math.max(0, index - 2), index + 3).join(' ')
    const hasIncome = INCOME_HEADER.test(nearby)
    const hasDeductions = DEDUCTIONS_HEADER.test(nearby)
    const hasVatOrTotal = VAT_HEADER.test(nearby) && TOTAL_HEADER.test(nearby)
    if (hasIncome && hasDeductions && hasVatOrTotal) {
      headerIndex = index
      break
    }
  }

  const searchFrom = headerIndex >= 0 ? headerIndex + 1 : 0
  let best: { gross: number; expenses: number; vat: number; net: number } | null = null

  // same-line totals row (most common when ocr keeps columns together)
  for (let index = searchFrom; index < lines.length; index++) {
    const line = lines[index]!
    if (OPENING_CLOSING.test(line) && best) break

    const amounts = extractAmounts(line)
    const ordered = tryIncomeDeductionQuartet(amounts)
    if (ordered) best = ordered
    const shuffled = assignIncomeDeductionQuartet(amounts, preferredNet)
    if (shuffled) best = shuffled
  }

  if (best && (preferredNet == null || amountsClose(best.net, preferredNet))) {
    return best
  }

  // real device ocr often reads the totals block as Net/Gross/Expenses/VAT just above Opening Balance
  const beforeOpening = amountsBeforeOpeningBalance(lines)
  if (beforeOpening.length >= 4) {
    const tail = beforeOpening.slice(-4)
    best =
      assignIncomeDeductionQuartet(tail, preferredNet) ??
      tryIncomeDeductionQuartet(tail) ??
      best
  }

  if (best && (preferredNet == null || amountsClose(best.net, preferredNet))) {
    return best
  }

  // column-ish ocr: amounts split across consecutive lines
  const stream: number[] = []
  for (let index = searchFrom; index < lines.length; index++) {
    const line = lines[index]!
    if (OPENING_CLOSING.test(line) && stream.length >= 4) break
    stream.push(...extractAmounts(line))
  }

  for (let index = 0; index <= stream.length - 4; index++) {
    const window = stream.slice(index, index + 4)
    const match =
      assignIncomeDeductionQuartet(window, preferredNet) ??
      tryIncomeDeductionQuartet(window)
    if (match) best = match
  }

  return best
}

/** Harris Shields-style: Payments | Receipts + Payment to Landlord */
function pickPaymentsReceiptsTotals(lines: string[]) {
  const joined = lines.join(' ')
  const looksLikePaymentsReceipts =
    (PAYMENTS_HEADER.test(joined) && RECEIPTS_HEADER.test(joined)) ||
    PAYMENT_TO_LANDLORD.test(joined) ||
    SUBTOTAL.test(joined)

  if (!looksLikePaymentsReceipts) return null

  let paymentToLandlord: number | null = null
  let receiptsSubtotal: number | null = null
  let paymentsSubtotal: number | null = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const next = lines[index + 1]
    const nextAmounts = next ? extractAmounts(next) : []

    if (PAYMENT_TO_LANDLORD.test(line)) {
      const amounts = extractAmounts(line)
      paymentToLandlord = amounts[amounts.length - 1] ?? nextAmounts[0] ?? null
    }

    if (SUBTOTAL.test(line)) {
      const amounts = extractAmounts(line)
      const values = amounts.length >= 2 ? amounts : [...amounts, ...nextAmounts]
      if (values.length >= 2) {
        // payments | receipts — receipts (income) is usually the right-hand total
        paymentsSubtotal = values[0]!
        receiptsSubtotal = values[1]!
      } else if (values.length === 1) {
        receiptsSubtotal = values[0]!
      }
    }
  }

  // fallback: largest labeled balance / paid amount as net when wording is noisy
  if (paymentToLandlord == null) {
    paymentToLandlord = pickBalanceNet(lines)
  }

  if (receiptsSubtotal == null || paymentToLandlord == null) return null

  const gross = receiptsSubtotal
  const net = paymentToLandlord

  let expenses =
    paymentsSubtotal != null ? Math.round((paymentsSubtotal - net) * 100) / 100 : null
  if (expenses == null || expenses < 0) {
    expenses = Math.round((gross - net) * 100) / 100
  }
  if (expenses < 0) expenses = 0

  return {
    gross,
    expenses,
    vat: 0,
    net,
  }
}

function pickBalanceNet(lines: string[]) {
  for (const line of lines) {
    if (!BALANCE_PAID.test(line) || OPENING_CLOSING.test(line)) continue
    const amounts = extractAmounts(line)
    if (amounts.length > 0) return amounts[amounts.length - 1]!
  }
  return null
}

function pickAmounts(lines: string[]) {
  const incomeStyle = pickIncomeDeductionsTotals(lines)
  if (incomeStyle) {
    return {
      grossRents: formatMoney(incomeStyle.gross),
      expenses: formatMoney(incomeStyle.expenses),
      vatOnExpenses: formatMoney(incomeStyle.vat),
      netReceived: formatMoney(incomeStyle.net),
    }
  }

  const paymentsStyle = pickPaymentsReceiptsTotals(lines)
  if (paymentsStyle) {
    return {
      grossRents: formatMoney(paymentsStyle.gross),
      expenses: formatMoney(paymentsStyle.expenses),
      vatOnExpenses: formatMoney(paymentsStyle.vat),
      netReceived: formatMoney(paymentsStyle.net),
    }
  }

  const net = pickBalanceNet(lines)
  return {
    grossRents: null,
    expenses: null,
    vatOnExpenses: null,
    netReceived: net == null ? null : formatMoney(net),
  }
}

/**
 * Parse OCR text from a landlord / letting-agent statement.
 * Supports common UK formats e.g. FlexResidential (income/deductions/VAT)
 * and Harris Shields-style (payments/receipts + payment to landlord).
 */
export function parseLandlordStatementText(text: string): ParsedLandlordStatementFields {
  const lines = normalizeLines(text)
  if (lines.length === 0) return { ...emptyParsed }

  const amounts = pickAmounts(lines)

  return {
    lettingAgent: pickLettingAgent(lines),
    date: pickStatementDate(lines),
    grossRents: amounts.grossRents,
    expenses: amounts.expenses,
    vatOnExpenses: amounts.vatOnExpenses,
    netReceived: amounts.netReceived,
  }
}
