import { detectMerchantDocumentType } from './detectDocumentType'
import {
  extractDocumentFingerprints,
  normalizeFingerprintValue,
  type MerchantFingerprintSignalType,
  type UserMerchantFingerprint,
} from './extractDocumentFingerprints'
import { matchKnownMerchant, normalizeForMatch } from './knownMerchants'
import { normalizeMerchantNames } from './normalizeMerchantName'
import { MERCHANT_CONFIDENCE, MERCHANT_SCORE, scoreToConfidence } from './scoringConfig'

import type { MerchantDocumentType } from './detectDocumentType'

export type MerchantResolveResult = {
  merchantRaw: string | null
  merchantDisplay: string | null
  confidence: number
  documentType: MerchantDocumentType
  evidence: string[]
  candidates: Array<{ name: string; score: number }>
}

type ScoredCandidate = {
  name: string
  score: number
  evidence: string[]
  lineIndex: number
}

const SUPPLIER_LABEL_NAMES =
  'bill\\s*from|invoice\\s*from|from|supplier(?:\\s*name)?|vendor|merchant|sold\\s*by|issued\\s*by|provided\\s*by|company|seller|trading\\s*as'

const SUPPLIER_LABEL = new RegExp(`^(?:${SUPPLIER_LABEL_NAMES})\\b`, 'i')
/** bare "Bill from:" / "From:" — value is on the next line */
const SUPPLIER_LABEL_ONLY = new RegExp(`^(?:${SUPPLIER_LABEL_NAMES})\\s*[:-]?\\s*$`, 'i')
/** inline "Bill from: Acme Ltd" — requires a real value after the separator */
const SUPPLIER_INLINE = new RegExp(
  `^(?:${SUPPLIER_LABEL_NAMES})\\b\\s*[:-]\\s*(.+)$`,
  'i',
)

const CUSTOMER_LABEL_NAMES =
  'bill\\s*to|billed\\s*to|invoice\\s*to|sold\\s*to|ship\\s*to|deliver\\s*to|customer(?:\\s*name)?|client'

const CUSTOMER_LABEL = new RegExp(`^(?:${CUSTOMER_LABEL_NAMES})\\b`, 'i')
const CUSTOMER_LABEL_ONLY = new RegExp(`^(?:${CUSTOMER_LABEL_NAMES})\\s*[:-]?\\s*$`, 'i')
const CUSTOMER_INLINE = new RegExp(
  `^(?:${CUSTOMER_LABEL_NAMES})\\b\\s*[:-]\\s*(.+)$`,
  'i',
)

/** receipt chrome that starts with "customer" but is not a bill-to block */
const NOT_CUSTOMER_BLOCK =
  /^(customer\s*copy|customer\s*service|customer\s*care|client\s*copy)\b/i

const COMPANY_SUFFIX =
  /\b(ltd\.?|limited|llc|plc|llp|inc\.?|corp\.?|aps|gmbh|ab|oy|as|nv|sa|bv)\b/i

const ADDRESS_LIKE =
  /\b(street|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|blvd\.?|boulevard|close|way|court|place|house|unit|floor|vej)\b|gade\b/i

const VAT_NEARBY = /\b(vat\s*(?:no|number|#)?|tax\s*(?:no|number|#)?)\b/i

const GENERIC_PHRASE =
  /^(need\s+help|help|thank\s*you|thanks|receipt|ticket|authorization|auth|aid|debit|credit|invoice(?:\s*number)?|date(?:\s*of\s*issue)?|paid|payment|payments|subtotal|total|invoice\s+total|amount(?:\s*due)?|vat|tax(?:\s*number)?|card|visa|mastercard|amex|cash|change|item|qty|quantity|unit\s*price|notes|description|customer(?:\s*copy)?|merchant\s*copy|bill\s*to|ship\s*to|bill\s*from)\b/i

const CUSTOMER_SERVICE =
  /need\s+help|thanks?\s+for\s+being|customer\s+service|contact\s+us|support@/i

const TERMINAL_CHROME = /^(ticket|receipt|authorization|auth|aid|debit|credit)\b\s*[:#]/i

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

function isUrlOrEmail(line: string) {
  return /@|www\.|https?:\/\//i.test(line)
}

function isDateLike(line: string) {
  return (
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(line) ||
    /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b/.test(line) ||
    /\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\b/.test(line) ||
    /\b(?:date|dated|issued)\b/i.test(line)
  )
}

function isMoneyLike(line: string) {
  return /[£$€]\s*\d|\b\d+\.\d{2}\b/.test(line)
}

function isNumericOnly(line: string) {
  return /^[\d\s£$.,:+\-/#]+$/.test(line)
}

function isAddressLine(line: string) {
  if (COMPANY_SUFFIX.test(line)) return false
  if (/^\d/.test(line)) return true
  if (ADDRESS_LIKE.test(line) && /\d/.test(line)) return true
  // place + postcode ("1717 Copenhagen V") — not store ids ("TESCO STORES 6247")
  if (/\b\d{4,5}\b/.test(line) && /[A-Za-z]{3,}/.test(line) && !isMoneyLike(line)) {
    if (/^[A-Za-z].*\b\d{3,5}\s*$/.test(line) && !ADDRESS_LIKE.test(line)) {
      return false
    }
    return true
  }
  if (
    /^(united\s+kingdom|united\s+states|denmark|sweden|norway|germany|france|ireland)\b/i.test(
      line,
    )
  ) {
    return true
  }
  return false
}

function isPlausibleMerchantName(line: string) {
  if (line.length < 2 || line.length > 80) return false
  if (GENERIC_PHRASE.test(line)) return false
  if (TERMINAL_CHROME.test(line)) return false
  if (/\?/.test(line)) return false
  if (isUrlOrEmail(line)) return false
  if (isNumericOnly(line)) return false
  if (isMoneyLike(line)) return false
  if (isDateLike(line)) return false
  if (isAddressLine(line)) return false
  if (CUSTOMER_LABEL_ONLY.test(line) || SUPPLIER_LABEL_ONLY.test(line)) return false
  if (CUSTOMER_INLINE.test(line) || SUPPLIER_INLINE.test(line)) return false
  if (!/[A-Za-z]/.test(line)) return false
  // reject "Ticket: 22", "AID A0 00…" style chrome
  if (/^[A-Za-z]{2,16}\s*:\s*\S+$/.test(line) && !COMPANY_SUFFIX.test(line)) {
    return false
  }
  if (/^AID\b/i.test(line)) return false
  return true
}

function customerZoneRanges(lines: string[]) {
  const ranges: Array<{ start: number; end: number }> = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (NOT_CUSTOMER_BLOCK.test(line)) continue

    const inlineName = line.match(CUSTOMER_INLINE)?.[1]?.trim()
    const opensZone =
      (inlineName && isPlausibleMerchantName(inlineName)) ||
      CUSTOMER_LABEL_ONLY.test(line)
    if (!opensZone) continue

    let end = Math.min(lines.length, index + 7)
    for (let cursor = index + 1; cursor < end; cursor++) {
      const next = lines[cursor]!
      if (SUPPLIER_LABEL_ONLY.test(next) || SUPPLIER_INLINE.test(next)) {
        end = cursor
        break
      }
    }
    ranges.push({ start: index, end })
  }
  return ranges
}

function inCustomerZone(lineIndex: number, zones: Array<{ start: number; end: number }>) {
  return zones.some((zone) => lineIndex >= zone.start && lineIndex < zone.end)
}

function lineMentionsVat(lines: string[], around: number) {
  for (let i = around; i <= Math.min(lines.length - 1, around + 4); i++) {
    if (VAT_NEARBY.test(lines[i]!)) return true
  }
  return false
}

function addressFollows(lines: string[], index: number) {
  const next = lines[index + 1]
  return Boolean(next && isAddressLine(next))
}

function extractLabeledNames(
  lines: string[],
  labelOnly: RegExp,
  inline: RegExp,
): Array<{ name: string; lineIndex: number }> {
  const found: Array<{ name: string; lineIndex: number }> = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const inlineMatch = line.match(inline)
    const inlineName = inlineMatch?.[1]?.trim()
    if (inlineName && isPlausibleMerchantName(inlineName)) {
      found.push({ name: inlineName, lineIndex: index })
      continue
    }

    // bare "Bill from:" / "Supplier:" — read the following name line
    if (!labelOnly.test(line)) continue

    for (let offset = 1; offset <= 3; offset++) {
      const next = lines[index + offset]
      if (!next) break
      if (
        SUPPLIER_LABEL_ONLY.test(next) ||
        CUSTOMER_LABEL_ONLY.test(next) ||
        SUPPLIER_INLINE.test(next) ||
        CUSTOMER_INLINE.test(next)
      ) {
        break
      }
      if (isAddressLine(next)) break
      if (!isPlausibleMerchantName(next)) break
      found.push({ name: next, lineIndex: index + offset })
      break
    }
  }
  return found
}

function countRepetitions(lines: string[], name: string) {
  const needle = normalizeForMatch(name)
  if (needle.length < 4) return 0
  let count = 0
  for (const line of lines) {
    const hay = normalizeForMatch(line)
    if (hay.includes(needle) || (hay.length >= 4 && needle.includes(hay))) count += 1
  }
  return count
}

function upsert(
  map: Map<string, ScoredCandidate>,
  name: string,
  lineIndex: number,
  score: number,
  evidence: string[],
) {
  const key = normalizeForMatch(name)
  if (!key) return
  const existing = map.get(key)
  if (!existing) {
    map.set(key, { name, score, evidence: [...evidence], lineIndex })
    return
  }
  if (score > existing.score) {
    existing.score = score
    existing.lineIndex = lineIndex
    existing.name = name
  }
  for (const item of evidence) {
    if (!existing.evidence.includes(item)) existing.evidence.push(item)
  }
}

function logCandidates(candidates: ScoredCandidate[]) {
  if (process.env.NODE_ENV === 'production') return
  const ranked = [...candidates].sort((a, b) => b.score - a.score).slice(0, 8)
  if (ranked.length === 0) return
  console.info(
    '[merchant-resolver] candidates\n' +
      ranked.map((item) => `${item.name.padEnd(28)} ${item.score}`).join('\n'),
  )
}

function fingerprintScore(type: MerchantFingerprintSignalType) {
  switch (type) {
    case 'vat':
      return MERCHANT_SCORE.fingerprintVat
    case 'company_number':
      return MERCHANT_SCORE.fingerprintCompanyNumber
    case 'phone':
      return MERCHANT_SCORE.fingerprintPhone
    case 'domain':
      return MERCHANT_SCORE.fingerprintDomain
    case 'postcode':
      return MERCHANT_SCORE.fingerprintPostcode
    case 'address_norm':
      return MERCHANT_SCORE.fingerprintAddress
    case 'ocr_raw_norm':
      return MERCHANT_SCORE.fingerprintOcrRaw
    default:
      return 0
  }
}

function applyUserFingerprints(
  scored: Map<string, ScoredCandidate>,
  text: string,
  userFingerprints: UserMerchantFingerprint[] | undefined,
): ScoredCandidate | null {
  if (!userFingerprints?.length) return null

  const byCanonical = new Map<
    string,
    { score: number; evidence: string[]; types: Set<string>; strong: boolean }
  >()

  const remember = (
    canonicalName: string,
    type: MerchantFingerprintSignalType,
    evidenceLine: string,
    strong: boolean,
  ) => {
    const key = normalizeForMatch(canonicalName)
    if (!key) return
    const bump = fingerprintScore(type)
    const existing = byCanonical.get(key) ?? {
      score: 0,
      evidence: [],
      types: new Set<string>(),
      strong: false,
    }
    if (!existing.types.has(type)) {
      existing.score += bump
      existing.types.add(type)
      existing.evidence.push(evidenceLine)
      if (strong) existing.strong = true
    }
    byCanonical.set(key, existing)
  }

  // strong supplier identity signals (vat / company number / domain)
  const documentSignals = extractDocumentFingerprints(text, { scope: 'supplier' })
  for (const signal of documentSignals) {
    if (
      signal.type !== 'vat' &&
      signal.type !== 'company_number' &&
      signal.type !== 'domain'
    ) {
      continue
    }
    for (const saved of userFingerprints) {
      if (saved.signalType !== signal.type) continue
      if (saved.signalValue !== signal.value) continue
      remember(
        saved.canonicalName,
        signal.type,
        `Matched saved ${signal.type.replace(/_/g, ' ')} fingerprint`,
        true,
      )
    }
  }

  // ocr suggestion corrections: rematch when the mangled text appears again
  // (exact line, substring, or anywhere in the document — ocr often splits names)
  const ocrNames = new Set<string>()
  for (const candidate of scored.values()) {
    ocrNames.add(candidate.name)
  }
  for (const line of normalizeLines(text)) {
    ocrNames.add(line)
  }
  const documentNorm = normalizeFingerprintValue('ocr_raw_norm', text)

  for (const saved of userFingerprints) {
    if (saved.signalType !== 'ocr_raw_norm') continue
    const signal = saved.signalValue.trim()
    if (!signal || signal.length < 4) continue

    let matched =
      Boolean(documentNorm) && documentNorm.includes(signal) && signal.length >= 4

    if (!matched) {
      for (const name of ocrNames) {
        const rawKey = normalizeFingerprintValue('ocr_raw_norm', name)
        if (!rawKey || rawKey.length < 4) continue
        if (rawKey === signal) {
          matched = true
          break
        }
        if (signal.length >= 8 && rawKey.includes(signal)) {
          matched = true
          break
        }
        if (rawKey.length >= 8 && signal.includes(rawKey)) {
          matched = true
          break
        }
      }
    }

    if (!matched) continue
    remember(
      saved.canonicalName,
      'ocr_raw_norm',
      'Matched saved OCR name correction',
      true,
    )
  }

  let best: ScoredCandidate | null = null
  for (const [key, match] of byCanonical) {
    if (!match.strong) continue
    const fingerprint = userFingerprints.find(
      (item) => normalizeForMatch(item.canonicalName) === key,
    )
    if (!fingerprint) continue
    const score = match.score + MERCHANT_SCORE.fingerprintOverride
    upsert(scored, fingerprint.canonicalName, 0, score, match.evidence)
    const candidate: ScoredCandidate = {
      name: fingerprint.canonicalName,
      score,
      evidence: match.evidence,
      lineIndex: 0,
    }
    if (!best || candidate.score > best.score) best = candidate
  }
  return best
}

export function resolveMerchant(input: {
  text: string
  preferredType?: MerchantDocumentType | null
  userFingerprints?: UserMerchantFingerprint[]
}): MerchantResolveResult {
  const lines = normalizeLines(input.text)
  const documentType =
    input.preferredType && input.preferredType !== 'unknown'
      ? input.preferredType
      : detectMerchantDocumentType(input.text)

  const empty: MerchantResolveResult = {
    merchantRaw: null,
    merchantDisplay: null,
    confidence: 0,
    documentType,
    evidence: [],
    candidates: [],
  }
  if (lines.length === 0) return empty

  const zones = customerZoneRanges(lines)
  const scored = new Map<string, ScoredCandidate>()

  for (const hit of extractLabeledNames(lines, SUPPLIER_LABEL_ONLY, SUPPLIER_INLINE)) {
    const evidence = ['Found immediately after supplier label']
    let score = MERCHANT_SCORE.supplierLabelMatch
    if (addressFollows(lines, hit.lineIndex)) {
      score += MERCHANT_SCORE.addressFollows
      evidence.push('Supplier address follows merchant')
    }
    if (lineMentionsVat(lines, hit.lineIndex)) {
      score += MERCHANT_SCORE.vatNearby
      evidence.push('VAT number follows supplier block')
    }
    if (COMPANY_SUFFIX.test(hit.name)) {
      score += MERCHANT_SCORE.companySuffix
      evidence.push('Company suffix present')
    }
    upsert(scored, hit.name, hit.lineIndex, score, evidence)
  }

  for (const hit of extractLabeledNames(lines, CUSTOMER_LABEL_ONLY, CUSTOMER_INLINE)) {
    upsert(scored, hit.name, hit.lineIndex, MERCHANT_SCORE.afterBillTo, [
      'Appears after customer / Bill to label',
    ])
  }

  const scanLimit =
    documentType === 'receipt' || documentType === 'unknown'
      ? Math.min(lines.length, 16)
      : Math.min(lines.length, 28)

  for (let index = 0; index < scanLimit; index++) {
    const line = lines[index]!
    const genericStem = line.split(/\s+https?:/i)[0]!.trim() || line

    if (
      GENERIC_PHRASE.test(line) ||
      TERMINAL_CHROME.test(line) ||
      /\?/.test(line) ||
      CUSTOMER_SERVICE.test(line)
    ) {
      let score = MERCHANT_SCORE.genericPhrase
      if (/\?/.test(line)) score += MERCHANT_SCORE.questionMark
      if (CUSTOMER_SERVICE.test(line)) score += MERCHANT_SCORE.customerService
      upsert(scored, genericStem, index, score, ['Generic / customer-service phrase'])
      continue
    }

    if (!isPlausibleMerchantName(line)) continue
    if (
      SUPPLIER_LABEL_ONLY.test(line) ||
      CUSTOMER_LABEL_ONLY.test(line) ||
      SUPPLIER_LABEL.test(line) ||
      CUSTOMER_LABEL.test(line)
    ) {
      continue
    }

    const evidence = ['Candidate in document body']
    let score = MERCHANT_SCORE.headerRegion
    if (index < 8) {
      score += MERCHANT_SCORE.nearTop
      evidence.push('Near top of document')
    }
    if (COMPANY_SUFFIX.test(line)) {
      score += MERCHANT_SCORE.companySuffix
      evidence.push('Company suffix present')
    }
    if (addressFollows(lines, index)) {
      score += MERCHANT_SCORE.addressFollows
      evidence.push('Supplier address follows merchant')
    }
    if (lineMentionsVat(lines, index)) {
      score += MERCHANT_SCORE.vatNearby
      evidence.push('VAT number follows supplier block')
    }
    if (inCustomerZone(index, zones)) {
      score += MERCHANT_SCORE.afterBillTo
      evidence.push('Inside Bill to / customer block')
    }
    if (isUrlOrEmail(line)) {
      score += MERCHANT_SCORE.urlOrEmail
      evidence.push('URL or email')
    }

    upsert(scored, line, index, score, evidence)
  }

  for (const candidate of scored.values()) {
    if (candidate.score <= -40) continue
    const repeats = countRepetitions(lines, candidate.name)
    if (repeats >= 2) {
      candidate.score += MERCHANT_SCORE.repeatedElsewhere
      candidate.evidence.push('Merchant name repeated elsewhere in document')
    }
    const known = matchKnownMerchant(candidate.name)
    if (known) {
      candidate.score += known.exact
        ? MERCHANT_SCORE.knownMerchantExact
        : MERCHANT_SCORE.knownMerchantFuzzy
      candidate.evidence.push(
        known.exact ? 'Known merchant exact match' : 'Known merchant fuzzy match',
      )
    }
  }

  applyUserFingerprints(scored, input.text, input.userFingerprints)

  const ranked = [...scored.values()].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.lineIndex - right.lineIndex
  })
  logCandidates(ranked)

  // prefer strong fingerprint hits over ocr body
  const fingerprintWinner = ranked.find((item) =>
    item.evidence.some(
      (line) =>
        /saved (vat|company number|domain) fingerprint/i.test(line) ||
        /OCR name correction/i.test(line),
    ),
  )
  const winner = fingerprintWinner ?? ranked.find((item) => item.score >= 20)
  const top = ranked[0]
  if (!winner) {
    return {
      ...empty,
      confidence: top ? scoreToConfidence(top.score) : 0,
      evidence: top?.evidence ?? [],
      candidates: ranked.slice(0, 6).map((item) => ({
        name: item.name,
        score: item.score,
      })),
    }
  }

  const confidence = scoreToConfidence(winner.score)
  const candidateSummary = ranked.slice(0, 6).map((item) => ({
    name: item.name,
    score: item.score,
  }))

  if (confidence < MERCHANT_CONFIDENCE.provisional) {
    return {
      merchantRaw: null,
      merchantDisplay: null,
      confidence,
      documentType,
      evidence: winner.evidence,
      candidates: candidateSummary,
    }
  }

  const fingerprintHit = winner.evidence.some(
    (item) => /saved .+ fingerprint/i.test(item) || /OCR name correction/i.test(item),
  )
  // fingerprint names are user-chosen — do not strip Ltd/LLC or remap via known merchants
  if (fingerprintHit) {
    const display = winner.name.replace(/\s+/g, ' ').trim()
    return {
      merchantRaw: display,
      merchantDisplay: display,
      confidence,
      documentType,
      evidence: winner.evidence,
      candidates: candidateSummary,
    }
  }

  const known = matchKnownMerchant(winner.name)
  const normalized = normalizeMerchantNames(winner.name)

  return {
    merchantRaw: normalized.merchantRaw,
    merchantDisplay: known?.canonical ?? normalized.merchantDisplay,
    confidence,
    documentType,
    evidence: winner.evidence,
    candidates: candidateSummary,
  }
}
