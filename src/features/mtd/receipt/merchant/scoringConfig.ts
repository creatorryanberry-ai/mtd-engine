/** tunable merchant candidate scores — keep magic numbers here */

export const MERCHANT_SCORE = {
  supplierLabelMatch: 100,
  knownMerchantExact: 80,
  knownMerchantFuzzy: 60,
  repeatedElsewhere: 40,
  companySuffix: 30,
  addressFollows: 20,
  vatNearby: 20,
  nearTop: 15,
  headerRegion: 10,

  fingerprintVat: 120,
  fingerprintCompanyNumber: 120,
  fingerprintPhone: 70,
  fingerprintDomain: 70,
  fingerprintPostcode: 40,
  fingerprintAddress: 40,
  fingerprintOcrRaw: 50,
  /** ensure saved fingerprints beat bill-from / known-merchant body hits */
  fingerprintOverride: 300,

  afterBillTo: -100,
  genericPhrase: -100,
  urlOrEmail: -100,
  totalOrPayment: -80,
  dateLike: -80,
  numericOnly: -80,
  customerService: -70,
  questionMark: -100,
} as const

export const MERCHANT_CONFIDENCE = {
  autoAccept: 0.9,
  provisional: 0.6,
} as const

/** map raw score to 0–1 confidence */
export function scoreToConfidence(score: number): number {
  if (score >= 140) return 0.99
  if (score >= 100) return 0.95
  if (score >= 70) return 0.85
  if (score >= 40) return 0.7
  // weak header / body hit — provisional, not auto-accept
  if (score >= 20) return 0.65
  if (score >= 0) return 0.4
  return 0.1
}
