export { detectMerchantDocumentType } from './detectDocumentType'
export type { MerchantDocumentType } from './detectDocumentType'
export { extractDocumentFingerprints } from './extractDocumentFingerprints'
export type {
  DocumentFingerprintSignal,
  MerchantFingerprintSignalType,
  UserMerchantFingerprint,
} from './extractDocumentFingerprints'
export {
  isMerchantProcessKind,
  matchFingerprintForDocument,
  matchProcessKindForDocument,
} from './matchFingerprint'
export type { MerchantProcessKind } from './matchFingerprint'
export { resolveMerchant } from './resolveMerchant'
export type { MerchantResolveResult } from './resolveMerchant'
export { normalizeMerchantNames } from './normalizeMerchantName'
export { MERCHANT_CONFIDENCE, MERCHANT_SCORE } from './scoringConfig'
