import {
  extractDocumentFingerprints,
  normalizeFingerprintValue,
  type UserMerchantFingerprint,
} from './extractDocumentFingerprints'
import {
  inboxProcessKinds,
  type InboxProcessKind,
} from '~/features/inbox/guessInboxDocumentKind'

export type MerchantProcessKind = InboxProcessKind

export function isMerchantProcessKind(value: string): value is MerchantProcessKind {
  return (inboxProcessKinds as readonly string[]).includes(value)
}

function ocrRawMatchesDocument(signalValue: string, text: string): boolean {
  const signal = signalValue.trim()
  if (!signal || signal.length < 4) return false

  const documentNorm = normalizeFingerprintValue('ocr_raw_norm', text)
  if (documentNorm.includes(signal)) return true

  for (const line of text.split(/\r?\n/)) {
    const rawKey = normalizeFingerprintValue('ocr_raw_norm', line)
    if (!rawKey || rawKey.length < 4) continue
    if (rawKey === signal) return true
    if (signal.length >= 8 && rawKey.includes(signal)) return true
    if (rawKey.length >= 8 && signal.includes(rawKey)) return true
  }
  return false
}

/**
 * find the first saved fingerprint that matches this OCR document.
 * same identity rules as resolveMerchant (vat / company / domain / ocr_raw_norm).
 */
export function matchFingerprintForDocument(
  text: string,
  fingerprints: UserMerchantFingerprint[],
): UserMerchantFingerprint | null {
  if (!text.trim() || fingerprints.length === 0) return null

  const documentSignals = extractDocumentFingerprints(text, { scope: 'supplier' })
  for (const signal of documentSignals) {
    if (
      signal.type !== 'vat' &&
      signal.type !== 'company_number' &&
      signal.type !== 'domain'
    ) {
      continue
    }
    const hit = fingerprints.find(
      (item) => item.signalType === signal.type && item.signalValue === signal.value,
    )
    if (hit) return hit
  }

  for (const saved of fingerprints) {
    if (saved.signalType !== 'ocr_raw_norm') continue
    if (ocrRawMatchesDocument(saved.signalValue, text)) return saved
  }

  return null
}

export function matchProcessKindForDocument(
  text: string,
  fingerprints: UserMerchantFingerprint[],
): MerchantProcessKind | null {
  const hit = matchFingerprintForDocument(text, fingerprints)
  if (!hit?.processKind || !isMerchantProcessKind(hit.processKind)) return null
  return hit.processKind
}

/** 1–99 from a matching fingerprint, else null */
export function matchPrivateUsePercentForDocument(
  text: string,
  fingerprints: UserMerchantFingerprint[],
): number | null {
  const hit = matchFingerprintForDocument(text, fingerprints)
  const percent = hit?.privateUsePercent
  if (percent == null || !Number.isFinite(percent)) return null
  const rounded = Math.round(percent)
  if (rounded < 1 || rounded > 99) return null
  return rounded
}
