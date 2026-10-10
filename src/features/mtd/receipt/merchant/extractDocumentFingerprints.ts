export type MerchantFingerprintSignalType =
  | 'vat'
  | 'company_number'
  | 'postcode'
  | 'phone'
  | 'domain'
  | 'address_norm'
  | 'ocr_raw_norm'

export type DocumentFingerprintSignal = {
  type: MerchantFingerprintSignalType
  value: string
}

export type UserMerchantFingerprint = {
  signalType: MerchantFingerprintSignalType
  signalValue: string
  canonicalName: string
  processKind?: string | null
  privateUsePercent?: number | null
}

/** signals strong enough to force a merchant name override */
export const STRONG_FINGERPRINT_TYPES = new Set<MerchantFingerprintSignalType>([
  'vat',
  'company_number',
  'domain',
])

const SIGNAL_TYPES = new Set<MerchantFingerprintSignalType>([
  'vat',
  'company_number',
  'postcode',
  'phone',
  'domain',
  'address_norm',
  'ocr_raw_norm',
])

export function isMerchantFingerprintSignalType(
  value: string,
): value is MerchantFingerprintSignalType {
  return SIGNAL_TYPES.has(value as MerchantFingerprintSignalType)
}

export function isStrongFingerprintType(type: MerchantFingerprintSignalType) {
  return STRONG_FINGERPRINT_TYPES.has(type)
}

/** strongest signal wins — one correction → one row */
const SIGNAL_PRIORITY: MerchantFingerprintSignalType[] = [
  'vat',
  'company_number',
  'domain',
  'ocr_raw_norm',
]

export function pickBestFingerprintSignal(
  signals: DocumentFingerprintSignal[],
): DocumentFingerprintSignal | null {
  const unique = new Map<string, DocumentFingerprintSignal>()
  for (const signal of signals) {
    if (!isMerchantFingerprintSignalType(signal.type)) continue
    const value = signal.value.trim()
    if (!value) continue
    unique.set(`${signal.type}:${value}`, { type: signal.type, value })
  }

  for (const type of SIGNAL_PRIORITY) {
    for (const signal of unique.values()) {
      if (signal.type === type) return signal
    }
  }
  return null
}

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[•●▪◦‣·∙*\-–—]+\s*/u, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeSignalValue(type: MerchantFingerprintSignalType, raw: string) {
  const trimmed = raw.trim().toLowerCase()
  if (type === 'vat' || type === 'company_number' || type === 'phone') {
    return digitsOnly(trimmed)
  }
  if (type === 'postcode') {
    return trimmed.replace(/\s+/g, '')
  }
  if (type === 'domain') {
    return trimmed.replace(/^www\./, '')
  }
  return trimmed
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeFingerprintValue(
  type: MerchantFingerprintSignalType,
  raw: string,
) {
  return normalizeSignalValue(type, raw)
}

function pushUnique(
  signals: DocumentFingerprintSignal[],
  type: MerchantFingerprintSignalType,
  raw: string,
) {
  const value = normalizeSignalValue(type, raw)
  if (!value || value.length < 3) return
  if (type === 'vat' && value.length < 8) return
  if (type === 'company_number' && value.length < 6) return
  if (type === 'phone' && value.length < 10) return
  if (signals.some((item) => item.type === type && item.value === value)) return
  signals.push({ type, value })
}

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi

const US_ZIP = /\b(\d{5}(?:-\d{4})?)\b/g

const CUSTOMER_LABEL =
  /^(bill\s*to|billed\s*to|invoice\s*to|sold\s*to|ship\s*to|deliver\s*to|customer(?:\s*name)?|client)\b/i

const NOT_CUSTOMER_BLOCK =
  /^(customer\s*copy|customer\s*service|customer\s*care|client\s*copy)\b/i

const SUPPLIER_LABEL =
  /^(bill\s*from|invoice\s*from|from|supplier(?:\s*name)?|vendor|merchant|sold\s*by|issued\s*by)\b/i

function customerZoneLineIndexes(lines: string[]) {
  const blocked = new Set<number>()
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (NOT_CUSTOMER_BLOCK.test(line)) continue
    if (!CUSTOMER_LABEL.test(line)) continue
    for (let cursor = index; cursor < Math.min(lines.length, index + 8); cursor++) {
      if (cursor > index && SUPPLIER_LABEL.test(lines[cursor]!)) break
      blocked.add(cursor)
    }
  }
  return blocked
}

function supplierZoneLineIndexes(lines: string[]) {
  const allowed = new Set<number>()
  for (let index = 0; index < lines.length; index++) {
    if (!SUPPLIER_LABEL.test(lines[index]!)) continue
    for (let cursor = index; cursor < Math.min(lines.length, index + 8); cursor++) {
      if (cursor > index && CUSTOMER_LABEL.test(lines[cursor]!)) break
      allowed.add(cursor)
    }
  }
  return allowed
}

function extractFromHaystack(
  haystack: string,
  signals: DocumentFingerprintSignal[],
  options: { phones: boolean; postcodes: boolean; domains: boolean },
) {
  for (const match of haystack.matchAll(
    /\b(?:vat|tax)\s*(?:no\.?|number|#)?\s*[:.]?\s*(?:gb\s*)?([A-Z0-9][A-Z0-9\s]{6,18})\b/gi,
  )) {
    pushUnique(signals, 'vat', match[1]!)
  }

  for (const match of haystack.matchAll(
    /\b(?:company|registered|co\.?)\s*(?:no\.?|number|#|reg\.?)\s*[:.]?\s*([A-Z0-9]{6,10})\b/gi,
  )) {
    pushUnique(signals, 'company_number', match[1]!)
  }

  if (options.domains) {
    for (const match of haystack.matchAll(
      /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9.-]+\.[a-z]{2,})\b/gi,
    )) {
      const host = match[1]!
      if (/^(gmail|yahoo|hotmail|outlook|icloud)\./i.test(host)) continue
      pushUnique(signals, 'domain', host)
    }
  }

  if (options.phones) {
    for (const match of haystack.matchAll(
      /\b(?:tel|telephone|phone|mob|mobile)\s*[:.]?\s*([+\d][\d\s().-]{8,})\b/gi,
    )) {
      pushUnique(signals, 'phone', match[1]!)
    }
  }

  if (options.postcodes) {
    for (const match of haystack.matchAll(UK_POSTCODE)) {
      pushUnique(signals, 'postcode', match[1]!)
    }
    for (const match of haystack.matchAll(US_ZIP)) {
      pushUnique(signals, 'postcode', match[1]!)
    }
  }
}

/**
 * deterministic document fingerprints for merchant learning / matching.
 * does not persist full ocr text — only compact signal keys.
 *
 * `scope: 'supplier'` prefers bill-from / supplier blocks and skips bill-to,
 * so the user's own address/phone on invoices is not treated as the merchant.
 */
export function extractDocumentFingerprints(
  text: string,
  options?: {
    ocrRawMerchant?: string | null
    scope?: 'document' | 'supplier'
    /** when learning, only keep signals safe to force a merchant match */
    strongOnly?: boolean
  },
): DocumentFingerprintSignal[] {
  const lines = normalizeLines(text)
  const signals: DocumentFingerprintSignal[] = []
  const scope = options?.scope ?? 'document'
  const customerBlocked = customerZoneLineIndexes(lines)
  const supplierAllowed = supplierZoneLineIndexes(lines)

  const scopedLines =
    scope === 'supplier' && supplierAllowed.size > 0
      ? lines.filter((_, index) => supplierAllowed.has(index))
      : scope === 'supplier'
        ? lines.filter((_, index) => !customerBlocked.has(index))
        : lines.filter((_, index) => !customerBlocked.has(index))

  const haystack = scopedLines.join('\n')
  extractFromHaystack(haystack, signals, {
    // only take phone/postcode from an explicit supplier block — never from the whole doc
    phones: scope === 'supplier' && supplierAllowed.size > 0,
    postcodes: scope === 'supplier' && supplierAllowed.size > 0,
    domains: true,
  })

  // VAT / company number also scanned on full text (often near totals) but not in customer zone
  const fullSafe = lines.filter((_, index) => !customerBlocked.has(index)).join('\n')
  extractFromHaystack(fullSafe, signals, {
    phones: false,
    postcodes: false,
    domains: false,
  })

  if (supplierAllowed.size > 0) {
    for (const index of supplierAllowed) {
      const line = lines[index]
      if (!line) continue
      if (
        /\b(street|road|rd\.?|avenue|ave\.?|blvd\.?|boulevard|lane|drive|close|way|house)\b/i.test(
          line,
        ) ||
        /^\d/.test(line)
      ) {
        pushUnique(signals, 'address_norm', line)
      }
    }
  }

  if (options?.ocrRawMerchant?.trim()) {
    pushUnique(signals, 'ocr_raw_norm', options.ocrRawMerchant)
  }

  if (options?.strongOnly) {
    return signals.filter((signal) => isStrongFingerprintType(signal.type))
  }

  return signals
}
