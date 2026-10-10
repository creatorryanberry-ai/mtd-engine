export const inboxProcessKinds = ['receipt', 'invoice', 'cis', 'landlord'] as const
export type InboxProcessKind = (typeof inboxProcessKinds)[number]

export type InboxKindGuess = {
  kind: InboxProcessKind
  confidence: 'high' | 'low'
}

type ScoreRule = {
  kind: InboxProcessKind
  points: number
  pattern: RegExp
}

const RULES: ScoreRule[] = [
  { kind: 'cis', points: 6, pattern: /construction\s+industry\s+scheme/i },
  { kind: 'cis', points: 5, pattern: /sub[\s-]*contractor\s+monthly\s+statement/i },
  { kind: 'cis', points: 5, pattern: /\bcis\s+voucher\b/i },
  { kind: 'cis', points: 4, pattern: /\bcis\s+tax\s+deducted\b/i },
  { kind: 'cis', points: 4, pattern: /\bgross\s+amount\s+paid\b/i },
  { kind: 'cis', points: 3, pattern: /\btax\s+deducted\b/i },
  { kind: 'cis', points: 2, pattern: /\bcis\b/i },

  { kind: 'landlord', points: 6, pattern: /landlord\s+statement/i },
  { kind: 'landlord', points: 5, pattern: /payment\s+to\s+landlord/i },
  { kind: 'landlord', points: 4, pattern: /\bstatement\s*:\s*\d{1,2}\s+\w+\s+\d{4}\b/i },
  { kind: 'landlord', points: 4, pattern: /\bgross\s+rents?\b/i },
  { kind: 'landlord', points: 3, pattern: /\bmanagement\s+fee\b/i },
  { kind: 'landlord', points: 3, pattern: /\bclient\s+account\b/i },
  { kind: 'landlord', points: 3, pattern: /\bletting\s+agents?\b/i },
  { kind: 'landlord', points: 2, pattern: /\bresidential\b/i },
  { kind: 'landlord', points: 2, pattern: /\blandlord\b/i },

  { kind: 'invoice', points: 6, pattern: /\btax\s+invoice\b/i },
  { kind: 'invoice', points: 4, pattern: /\binvoice\s*(?:no\.?|number|#)\b/i },
  { kind: 'invoice', points: 3, pattern: /\binvoice[\s_-]*\d{2,}\b/i },
  { kind: 'invoice', points: 1, pattern: /\binvoice\b/i },
  { kind: 'invoice', points: 3, pattern: /\bbill\s+to\b/i },
  { kind: 'invoice', points: 2, pattern: /\bamount\s+due\b/i },

  { kind: 'receipt', points: 4, pattern: /\bvat\s+receipt\b/i },
  { kind: 'receipt', points: 3, pattern: /\bcustomer\s+copy\b/i },
  { kind: 'receipt', points: 3, pattern: /\bmerchant\s+copy\b/i },
  { kind: 'receipt', points: 2, pattern: /\bthank\s+you\b/i },
  { kind: 'receipt', points: 2, pattern: /\breceipt\b/i },
  { kind: 'receipt', points: 2, pattern: /\bcard\s+payment\b/i },
]

const HIGH_SCORE = 4
const HIGH_MARGIN = 2
const TITLE_LINE_SCAN_COUNT = 6
const INVOICE_TITLE_BONUS = 3
const INVOICE_TITLE_PATTERN = /^(?:\s|[#>*-])*(?:tax\s+)?invoice\b/im

const BILL_TO_LABEL =
  /^(bill\s*to|invoice\s*to|sold\s*to|ship\s*to|customer|client|account\s*name|for\s*the\s*attention\s*of|fao|attn\.?)\b/i
/** "Bill to: Acme" or OCR "Bill to Acme" on one line */
const BILL_TO_INLINE =
  /^(?:bill\s*to|invoice\s*to|sold\s*to|customer|client)\b\s*[:-]?\s*(.+)$/i
const BILL_TO_NEARBY = /\b(?:bill\s*to|invoice\s*to|sold\s*to)\b/i
const COMPANY_SUFFIX =
  /\b(ltd\.?|limited|plc|llp|inc\.?|corp\.?|aps|gmbh|llc|co\.?|company)\b/i
const ADDRESS_LIKE =
  /\b(street|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|close|cl\.?|way|court|ct\.?|place|pl\.?|house|unit|floor)\b/i

function emptyScores(): Record<InboxProcessKind, number> {
  return { receipt: 0, invoice: 0, cis: 0, landlord: 0 }
}

function scoreHaystack(haystack: string) {
  const scores = emptyScores()
  if (!haystack.trim()) return scores
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) {
      scores[rule.kind] += rule.points
    }
  }
  return scores
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(
      /\b(ltd\.?|limited|plc|llp|inc\.?|corp\.?|aps|gmbh|llc|co\.?|company)\b/gi,
      ' ',
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function namesMatch(left: string, right: string) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true
  return false
}

function looksLikeAddressOrPlace(line: string) {
  if (COMPANY_SUFFIX.test(line)) return false
  if (ADDRESS_LIKE.test(line)) return true
  if (/^\d/.test(line)) return true
  if (!/\s/.test(line) && /^[A-Za-z.'-]+$/.test(line) && line.length <= 24) return true
  return false
}

function extractBillToNames(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const names: string[] = []

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const inline = line.match(BILL_TO_INLINE)
    if (inline?.[1]?.trim()) {
      const rest = inline[1].trim()
      // bare "Bill to" with nothing after — fall through to following lines
      if (rest.length > 0) {
        names.push(rest)
        continue
      }
    }
    if (!BILL_TO_LABEL.test(line)) continue
    // label-only line (or label with no usable rest)
    if (BILL_TO_INLINE.test(line) && inline?.[1]?.trim()) continue

    for (let offset = 1; offset <= 3; offset++) {
      const next = lines[index + offset]
      if (!next) break
      if (BILL_TO_LABEL.test(next)) break
      if (looksLikeAddressOrPlace(next)) break
      if (/^(invoice|date|due|vat|total|amount|payment|from|supplier)\b/i.test(next))
        break
      if (next.length < 2 || next.length > 80) break
      names.push(next)
      break
    }
  }

  return names
}

function selfNameInBillToWindow(text: string, selfNames: string[]) {
  const collapsed = text.toLowerCase().replace(/\s+/g, ' ')
  const match = BILL_TO_NEARBY.exec(collapsed)
  if (!match || match.index == null) return false
  const window = collapsed.slice(match.index, match.index + 160)
  return selfNames.some((selfName) => {
    const normalized = normalizeName(selfName)
    if (!normalized) return false
    if (window.includes(normalized)) return true
    const tokens = normalized.split(' ').filter((token) => token.length > 1)
    return tokens.length > 0 && tokens.every((token) => window.includes(token))
  })
}

function isBilledToSelf(text: string | null | undefined, selfNames: string[]) {
  if (!text?.trim() || selfNames.length === 0) return false
  const billToNames = extractBillToNames(text)
  if (
    billToNames.some((billTo) =>
      selfNames.some((selfName) => namesMatch(billTo, selfName)),
    )
  ) {
    return true
  }
  return selfNameInBillToWindow(text, selfNames)
}

export function guessInboxDocumentKind(input: {
  text?: string | null
  fileName?: string | null
  subject?: string | null
  /** business / user names — bill-to matches mean this is an expense receipt */
  selfNames?: string[] | null
  allowed: InboxProcessKind[]
}): InboxKindGuess {
  const allowed: InboxProcessKind[] =
    input.allowed.length > 0 ? input.allowed : ['receipt', 'invoice']
  const sections = [input.fileName, input.subject, input.text]
  const haystack = sections.filter(Boolean).join('\n').replace(/[_-]+/g, ' ')
  const scores = scoreHaystack(haystack)
  const titleArea = [input.subject, input.text]
    .filter(Boolean)
    .join('\n')
    .replace(/[_-]+/g, ' ')
    .split('\n')
    .slice(0, TITLE_LINE_SCAN_COUNT)
    .join('\n')
  if (INVOICE_TITLE_PATTERN.test(titleArea)) {
    scores.invoice += INVOICE_TITLE_BONUS
  }

  const selfNames = (input.selfNames ?? []).map((name) => name.trim()).filter(Boolean)
  if (isBilledToSelf(input.text, selfNames) && allowed.includes('receipt')) {
    return { kind: 'receipt', confidence: 'high' }
  }

  const ranked = allowed
    .map((kind) => ({ kind, score: scores[kind] }))
    .sort((left, right) => right.score - left.score)

  const winner = ranked[0] ?? { kind: 'receipt' as const, score: 0 }
  const runnerUp = ranked[1]?.score ?? 0
  const confidence =
    winner.score >= HIGH_SCORE && winner.score - runnerUp >= HIGH_MARGIN ? 'high' : 'low'

  return { kind: winner.kind, confidence }
}
