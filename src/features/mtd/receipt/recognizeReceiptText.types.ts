import type { ReceiptDocumentKind } from './parseReceiptText'
import type { UserMerchantFingerprint } from './merchant'

export type RecognizeReceiptResult = {
  text: string
  supplier: string | null
  date: string | null
  amount: string | null
  invoiceNumber: string | null
  nameCandidates: string[]
  nameNeedsConfirm: boolean
}

export type RecognizeReceiptOptions = {
  kind?: ReceiptDocumentKind
  mimeType?: string | null
  fileName?: string | null
  /** pdf only — default 2 */
  maxPdfPages?: number
  userFingerprints?: UserMerchantFingerprint[]
}
