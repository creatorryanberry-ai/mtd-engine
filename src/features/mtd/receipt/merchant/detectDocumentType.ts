export type MerchantDocumentType = 'receipt' | 'invoice' | 'cis' | 'landlord' | 'unknown'

const INVOICE_PATTERNS = [
  /\binvoice\s*(?:no\.?|number|#)?\b/i,
  /\bbill\s+to\b/i,
  /\bbill\s+from\b/i,
  /\btax\s+invoice\b/i,
  /\bamount\s+due\b/i,
  /\binvoice\s+total\b/i,
  /\bvat\s+invoice\b/i,
]

const RECEIPT_PATTERNS = [
  /\breceipt\b/i,
  /\btill\b/i,
  /\bcash\b/i,
  /\bchange\b/i,
  /\bcard\s+payment\b/i,
  /\bvisa\b/i,
  /\bmastercard\b/i,
  /\bthank\s+you\b/i,
  /\bcustomer\s+copy\b/i,
  /\bmerchant\s+copy\b/i,
]

const CIS_PATTERNS = [
  /construction\s+industry\s+scheme/i,
  /\bcis\s+voucher\b/i,
  /\bcis\s+tax\s+deducted\b/i,
]

const LANDLORD_PATTERNS = [
  /landlord\s+statement/i,
  /\bgross\s+rents?\b/i,
  /\bletting\s+agents?\b/i,
]

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0)
}

export function detectMerchantDocumentType(text: string): MerchantDocumentType {
  const haystack = text.replace(/[_-]+/g, ' ')
  const cis = countMatches(haystack, CIS_PATTERNS)
  if (cis >= 1) return 'cis'
  const landlord = countMatches(haystack, LANDLORD_PATTERNS)
  if (landlord >= 2) return 'landlord'
  const invoice = countMatches(haystack, INVOICE_PATTERNS)
  const receipt = countMatches(haystack, RECEIPT_PATTERNS)
  if (invoice >= 2 && invoice >= receipt) return 'invoice'
  if (receipt >= 2 && receipt > invoice) return 'receipt'
  if (invoice >= 1) return 'invoice'
  if (receipt >= 1) return 'receipt'
  return 'unknown'
}
