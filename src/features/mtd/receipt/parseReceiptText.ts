import { toTitleCase } from '~/features/mtd/utils/formatTransactionDisplay'
import { resolveMerchant } from '~/features/mtd/receipt/merchant'
import {
  normalizeFingerprintValue,
  type UserMerchantFingerprint,
} from '~/features/mtd/receipt/merchant/extractDocumentFingerprints'

export type ParsedReceiptFields = {
  /** merchant for receipts; bill-to customer for invoices */
  supplier: string | null
  date: string | null
  amount: string | null
  /** invoice / receipt reference when labelled */
  invoiceNumber: string | null
  /** other plausible names when the bill-to customer is ambiguous */
  nameCandidates: string[]
  nameNeedsConfirm: boolean
}

export type ReceiptDocumentKind = 'receipt' | 'invoice'

/** apply a saved OCR name correction to invoice customer candidates / document text */
function matchOcrNameFingerprint(
  names: Array<string | null | undefined>,
  text: string,
  fingerprints: UserMerchantFingerprint[] | undefined,
): string | null {
  if (!fingerprints?.length) return null
  const documentNorm = normalizeFingerprintValue('ocr_raw_norm', text)
  for (const saved of fingerprints) {
    if (saved.signalType !== 'ocr_raw_norm') continue
    const signal = saved.signalValue.trim()
    if (!signal || signal.length < 4) continue
    if (documentNorm.includes(signal)) return saved.canonicalName
    for (const name of names) {
      if (!name?.trim()) continue
      const rawKey = normalizeFingerprintValue('ocr_raw_norm', name)
      if (!rawKey) continue
      if (rawKey === signal) return saved.canonicalName
      if (signal.length >= 8 && rawKey.includes(signal)) return saved.canonicalName
      if (rawKey.length >= 8 && signal.includes(rawKey)) return saved.canonicalName
    }
  }
  return null
}

const SKIP_SUPPLIER_LINE =
  /^(receipt|ticket|authorization|auth|aid|tax\s*invoice|invoice|vat\s*receipt|thank\s*you|thanks?\s+for|need\s+help|customer\s*copy|merchant\s*copy|card\s*payment|contactless|chip\s*&\s*pin|change|cash|debit|credit|visa|mastercard|amex|total|subtotal|vat|tel|phone|www\.|http|https?:|email|order|till|terminal|notes?:|item|qty|unit\s*price|payments?:|paid)\b/i

const ADDRESS_LIKE =
  /\b(street|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|close|cl\.?|way|court|ct\.?|place|pl\.?|house|unit|floor|vej)\b|gade\b|strasse\b|straße\b/i

const COMPANY_SUFFIX =
  /\b(ltd\.?|limited|plc|llp|inc\.?|corp\.?|aps|gmbh|llc|ab|oy|as|nv|sa|bv)\b/i

const DATE_LABEL = /\b(date|dated|transaction\s*date|sale\s*date|invoice\s*date)\b/i
const AMOUNT_LABEL =
  /\b(total|amount\s*due|balance\s*due|grand\s*total|gross|to\s*pay|card\s*payment|paid|payment)\b/i
const VAT_LABEL = /\b(vat|tax)\b/i
const HAS_MONEY = /£|\d+\.\d{2}/

const BILL_TO_LABEL =
  /^(bill\s*to|invoice\s*to|sold\s*to|ship\s*to|customer|client|account\s*name|for\s*the\s*attention\s*of|fao|attn\.?)\b/i

const BILL_TO_INLINE =
  /^(?:bill\s*to|invoice\s*to|sold\s*to|customer|client)\b\s*[:-]?\s*(.+)$/i

const BILL_FROM_LABEL =
  /^(bill\s*from|invoice\s*from|sold\s*from|supplier|vendor|merchant|from)\b/i

const BILL_FROM_INLINE =
  /^(?:bill\s*from|invoice\s*from|sold\s*from|supplier|vendor|merchant|from)\b\s*[:-]?\s*(.+)$/i

const NOT_A_NAME_LINE =
  /^(invoice\s*(no|number|#)|date|due\s*date|vat|total|subtotal|amount|payment|bank|sort\s*code|account|iban|reference|ref\.?|page)\b/i

const INVOICE_NUMBER_INLINE =
  /\b(?:invoice\s*(?:no\.?|number|#)|inv\s*(?:no\.?|#)|reference|ref\.?)\s*[:#.-]*\s*([A-Z0-9][A-Z0-9\-/]{0,31})\b/i

const INVOICE_NUMBER_LABEL =
  /^(?:invoice\s*(?:no\.?|number|#)|inv\s*(?:no\.?|#)|reference|ref\.?)\s*[:#.-]*\s*$/i

/** inv-001, 1479, INV/2026/01 — not free text */
const INVOICE_NUMBER_VALUE = /^(?=.*\d)[A-Z0-9][A-Z0-9\-/]{0,31}$/i

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

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        // ocr often prefixes logos/list markers as bullets
        .replace(/^\s*[•●▪◦‣·∙*\-–—]+\s*/u, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
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
    // uk receipts are almost always day/month/year
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

  // july 15, 2026
  match = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/)
  if (match) {
    const month = MONTHS[match[1]!.toLowerCase()]
    if (!month) return null
    const yearRaw = Number(match[3])
    const year = yearRaw < 100 ? expandTwoDigitYear(yearRaw) : yearRaw
    return toIsoDate(year, month, Number(match[2]))
  }

  return null
}

function extractDates(line: string) {
  const patterns = [
    /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/g,
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g,
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/g,
    /\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/g,
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
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null
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

function stripMoneySuffix(line: string) {
  return line
    .replace(/[£$€]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*[A-Z]?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPlausibleNameLine(line: string) {
  if (line.length < 2 || line.length > 80) return false
  if (SKIP_SUPPLIER_LINE.test(line)) return false
  if (NOT_A_NAME_LINE.test(line)) return false
  if (/\?/.test(line)) return false
  if (BILL_TO_LABEL.test(line) && !BILL_TO_INLINE.test(line)) return false
  if (BILL_FROM_LABEL.test(line) && !BILL_FROM_INLINE.test(line)) return false
  if (ADDRESS_LIKE.test(line) && /\d/.test(line)) return false
  if (/@|www\.|https?:\/\//i.test(line)) return false
  if (/^[\d\s£$.,:+\-/#A-F]+$/i.test(line)) return false
  if (extractDates(line).length > 0 && line.length < 24) return false
  if (HAS_MONEY.test(line)) return false
  if (!/[A-Za-z]/.test(line)) return false
  return true
}

function isAddressLine(line: string) {
  if (COMPANY_SUFFIX.test(line)) return false
  // numbered street / unit lines — "123 High Street", "Skelbækgade 4"
  if (/^\d/.test(line)) return true
  if (ADDRESS_LIKE.test(line) && /\d/.test(line)) return true
  // house number token with a place/street word, not money/dates
  if (
    /(?:^|\s)\d+[a-z]?(?:\s|$)/i.test(line) &&
    /[A-Za-zÀ-ÿ]{4,}/.test(line) &&
    !HAS_MONEY.test(line) &&
    extractDates(line).length === 0 &&
    !SKIP_SUPPLIER_LINE.test(line) &&
    !NOT_A_NAME_LINE.test(line)
  ) {
    return true
  }
  // postcode + place: "1717 Copenhagen V"
  if (
    /\b\d{4,5}\b/.test(line) &&
    /[A-Za-zÀ-ÿ]{3,}/.test(line) &&
    !HAS_MONEY.test(line) &&
    extractDates(line).length === 0 &&
    !SKIP_SUPPLIER_LINE.test(line) &&
    !NOT_A_NAME_LINE.test(line)
  ) {
    return true
  }
  if (
    /^(united\s+kingdom|denmark|sweden|norway|germany|france|ireland|netherlands|belgium|spain|italy)\b/i.test(
      line,
    )
  ) {
    return true
  }
  return false
}

function isSupplierCandidateLine(line: string) {
  if (line.length < 2 || line.length > 60) return false
  if (SKIP_SUPPLIER_LINE.test(line)) return false
  if (/\?/.test(line)) return false
  if (DATE_LABEL.test(line)) return false
  if (AMOUNT_LABEL.test(line)) return false
  if (BILL_TO_LABEL.test(line)) return false
  if (BILL_FROM_LABEL.test(line)) return false
  if (isAddressLine(line)) return false
  if (/@|www\.|https?:\/\//i.test(line)) return false
  if (/^[\d\s£$.,:+\-/#A-F]+$/i.test(line)) return false
  if (extractDates(line).length > 0) return false
  if (HAS_MONEY.test(line)) return false
  if (!/[A-Za-z]/.test(line)) return false
  return true
}

function extractLabeledName(
  lines: string[],
  label: RegExp,
  inline: RegExp,
): string | null {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const inlineMatch = line.match(inline)
    if (inlineMatch?.[1]?.trim()) {
      const name = inlineMatch[1].trim()
      if (isPlausibleNameLine(name)) return name
      continue
    }

    if (!label.test(line)) continue
    // bare label only — read following lines
    if (inline.test(line) && inlineMatch?.[1]?.trim()) continue

    for (let offset = 1; offset <= 4; offset++) {
      const next = lines[index + offset]
      if (!next) break
      if (label.test(next) || BILL_TO_LABEL.test(next) || BILL_FROM_LABEL.test(next))
        break
      if (NOT_A_NAME_LINE.test(next)) break
      if (AMOUNT_LABEL.test(next) || DATE_LABEL.test(next)) break
      if (looksLikeAddressOrPlace(next)) {
        break
      }
      if (!isPlausibleNameLine(next)) break
      return next
    }
  }
  return null
}

function pickSupplier(lines: string[]) {
  const billFrom = extractLabeledName(lines, BILL_FROM_LABEL, BILL_FROM_INLINE)
  if (billFrom) return billFrom

  const window = lines.slice(0, 24)
  const billToIndex = window.findIndex((line) => BILL_TO_LABEL.test(line))
  const header = billToIndex >= 0 ? window.slice(0, billToIndex) : window

  // prefer company name sitting directly above an address block (not the logo OCR)
  for (let index = 0; index < header.length - 1; index++) {
    const line = header[index]!
    const next = header[index + 1]!
    if (!isSupplierCandidateLine(line)) continue
    if (!isAddressLine(next)) continue
    return line
  }

  // otherwise prefer any company-suffix name in the header
  for (const line of header) {
    if (isSupplierCandidateLine(line) && COMPANY_SUFFIX.test(line)) {
      return line
    }
  }

  let fallbackProduct: string | null = null
  for (const line of header) {
    if (line.length < 2 || line.length > 60) continue
    if (SKIP_SUPPLIER_LINE.test(line)) continue
    if (/\?/.test(line)) continue
    if (DATE_LABEL.test(line)) continue
    if (AMOUNT_LABEL.test(line)) continue
    if (BILL_TO_LABEL.test(line)) continue
    if (BILL_FROM_LABEL.test(line)) continue
    if (isAddressLine(line)) continue
    if (/@|www\.|https?:\/\//i.test(line)) continue
    if (/^[\d\s£$.,:+\-/#A-F]+$/i.test(line)) continue
    if (extractDates(line).length > 0) continue

    if (HAS_MONEY.test(line)) {
      const product = stripMoneySuffix(line)
      if (product.length >= 2 && !fallbackProduct) {
        fallbackProduct = product
      }
      continue
    }

    return line
  }

  return fallbackProduct
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
  }
  return result
}

function looksLikeAddressOrPlace(line: string) {
  if (COMPANY_SUFFIX.test(line)) return false
  if (isAddressLine(line)) return true
  // bare place names like "London"
  if (!/\s/.test(line) && /^[A-Za-z.'-]+$/.test(line) && line.length <= 24) return true
  return false
}

/** for invoices you raised: customer lives under Bill To, not the header */
function pickInvoiceCustomer(lines: string[]): {
  supplier: string | null
  nameCandidates: string[]
  nameNeedsConfirm: boolean
} {
  const billToNames: string[] = []

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const inline = line.match(BILL_TO_INLINE)
    if (inline?.[1]?.trim()) {
      const name = inline[1].trim()
      if (isPlausibleNameLine(name)) {
        billToNames.push(name)
      }
      continue
    }

    if (!BILL_TO_LABEL.test(line)) continue

    for (let offset = 1; offset <= 4; offset++) {
      const next = lines[index + offset]
      if (!next) break
      if (BILL_TO_LABEL.test(next)) break
      if (NOT_A_NAME_LINE.test(next)) break
      if (AMOUNT_LABEL.test(next) || DATE_LABEL.test(next)) break
      if (looksLikeAddressOrPlace(next)) {
        // address block after the customer name — stop
        if (billToNames.length > 0) break
        continue
      }
      if (!isPlausibleNameLine(next)) break
      billToNames.push(next)
      if (billToNames.length >= 2) break
    }
  }

  const candidates = uniqueNames(billToNames)
  if (candidates.length === 1) {
    return {
      supplier: candidates[0]!,
      nameCandidates: [],
      nameNeedsConfirm: false,
    }
  }
  if (candidates.length > 1) {
    return {
      supplier: null,
      nameCandidates: candidates.slice(0, 3),
      nameNeedsConfirm: true,
    }
  }

  // no bill-to section — ask rather than guessing the header (your business name)
  const header = pickSupplier(lines)
  return {
    supplier: null,
    nameCandidates: header ? [header] : [],
    nameNeedsConfirm: true,
  }
}

function pickDate(lines: string[]) {
  let labeled: string | null = null
  let first: string | null = null

  for (const line of lines) {
    const dates = extractDates(line)
    if (dates.length === 0) continue
    if (!first) first = dates[0]!
    if (!labeled && DATE_LABEL.test(line)) {
      labeled = dates[0]!
    }
  }

  return labeled ?? first
}

function pickAmount(lines: string[]) {
  let labeledTotal: number | null = null
  let labeledAny: number | null = null
  let largest: number | null = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const amounts = extractAmounts(line)
    const nextAmounts =
      amounts.length === 0 && lines[index + 1] ? extractAmounts(lines[index + 1]!) : []
    const lineAmount = amounts[amounts.length - 1] ?? null
    const nearbyAmount = lineAmount ?? nextAmounts[nextAmounts.length - 1] ?? null

    if (lineAmount != null && (largest == null || lineAmount > largest)) {
      largest = lineAmount
    }

    if (AMOUNT_LABEL.test(line) && !VAT_LABEL.test(line) && nearbyAmount != null) {
      labeledTotal = nearbyAmount
      break
    }

    if (AMOUNT_LABEL.test(line) && nearbyAmount != null && labeledAny == null) {
      labeledAny = nearbyAmount
    }
  }

  const value = labeledTotal ?? labeledAny ?? largest
  return value == null ? null : value.toFixed(2)
}

function isInvoiceNumberValue(value: string | undefined) {
  if (!value) return false
  if (/^(no|number|ref|reference)$/i.test(value)) return false
  return INVOICE_NUMBER_VALUE.test(value)
}

function pickInvoiceNumber(lines: string[]) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const inline = line.match(INVOICE_NUMBER_INLINE)
    if (inline?.[1]) {
      const value = inline[1].trim()
      if (isInvoiceNumberValue(value)) return value
    }

    if (!INVOICE_NUMBER_LABEL.test(line)) continue

    // ocr often puts the number on the line above the label (two-column layouts)
    const previous = lines[index - 1]?.trim()
    const next = lines[index + 1]?.trim()
    if (isInvoiceNumberValue(previous)) return previous!
    if (isInvoiceNumberValue(next)) return next!
  }

  return null
}

export function parseReceiptText(
  text: string,
  kind: ReceiptDocumentKind = 'receipt',
  options?: { userFingerprints?: UserMerchantFingerprint[] },
): ParsedReceiptFields {
  const lines = normalizeLines(text)
  if (lines.length === 0) {
    return {
      supplier: null,
      date: null,
      amount: null,
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    }
  }

  const date = pickDate(lines)
  const amount = pickAmount(lines)
  const invoiceNumber = pickInvoiceNumber(lines)

  if (kind === 'invoice') {
    const resolved = resolveMerchant({
      text,
      preferredType: 'invoice',
      userFingerprints: options?.userFingerprints,
    })
    const fingerprintHit = resolved.evidence.some(
      (item) => /saved .+ fingerprint/i.test(item) || /OCR name correction/i.test(item),
    )
    if (fingerprintHit && (resolved.merchantDisplay || resolved.merchantRaw)) {
      return {
        supplier: resolved.merchantDisplay ?? resolved.merchantRaw,
        date,
        amount,
        invoiceNumber,
        nameCandidates: [],
        nameNeedsConfirm: false,
      }
    }

    const customer = pickInvoiceCustomer(lines)
    // invoice customer names never go through the supplier scorer — still apply OCR corrections
    const ocrCorrection = matchOcrNameFingerprint(
      [customer.supplier, ...customer.nameCandidates],
      text,
      options?.userFingerprints,
    )
    if (ocrCorrection) {
      return {
        supplier: ocrCorrection,
        date,
        amount,
        invoiceNumber,
        nameCandidates: [],
        nameNeedsConfirm: false,
      }
    }

    return {
      supplier: customer.supplier ? toTitleCase(customer.supplier) : null,
      date,
      amount,
      invoiceNumber,
      nameCandidates: customer.nameCandidates.map((name) => toTitleCase(name)),
      nameNeedsConfirm: customer.nameNeedsConfirm,
    }
  }

  const resolved = resolveMerchant({
    text,
    preferredType: 'receipt',
    userFingerprints: options?.userFingerprints,
  })
  if (process.env.NODE_ENV !== 'production') {
    console.info('[merchant-fingerprint] resolve', {
      fingerprintCount: options?.userFingerprints?.length ?? 0,
      merchant: resolved.merchantDisplay ?? resolved.merchantRaw,
      evidence: resolved.evidence.slice(0, 4),
    })
  }
  return {
    supplier: resolved.merchantDisplay ?? resolved.merchantRaw,
    date,
    amount,
    invoiceNumber,
    nameCandidates: [],
    nameNeedsConfirm: false,
  }
}
