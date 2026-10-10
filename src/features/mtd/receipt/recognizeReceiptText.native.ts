import { parseReceiptText } from './parseReceiptText'
import { resolveOcrImageUris } from './resolveOcrImageUris'

import type {
  RecognizeReceiptOptions,
  RecognizeReceiptResult,
} from './recognizeReceiptText.types'

export type { RecognizeReceiptOptions, RecognizeReceiptResult }

function getMlkit() {
  // sync require — hermes can throw SyntaxError on dynamic import() of this module
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-mlkit-ocr') as typeof import('expo-mlkit-ocr')
}

export function isReceiptOcrAvailable() {
  try {
    return getMlkit().isSupported()
  } catch {
    return false
  }
}

function toFileUri(uri: string) {
  const trimmed = uri.trim()
  if (trimmed.startsWith('file://')) return trimmed
  if (trimmed.startsWith('/')) return `file://${trimmed}`
  return trimmed
}

export async function recognizeReceiptFromUri(
  uri: string,
  options?: RecognizeReceiptOptions,
): Promise<RecognizeReceiptResult> {
  const mlkit = getMlkit()
  if (!mlkit.isSupported()) {
    throw new Error('Receipt OCR is not supported on this device')
  }

  const pageUris = await resolveOcrImageUris({
    uri,
    mimeType: options?.mimeType,
    fileName: options?.fileName,
    maxPages: options?.maxPdfPages,
  })

  const pageTexts: string[] = []
  for (const pageUri of pageUris) {
    const fileUri = toFileUri(pageUri)
    if (!fileUri.startsWith('file://')) {
      throw new Error(`Receipt OCR needs a local file URI (got ${pageUri.slice(0, 32)})`)
    }
    const recognition = await mlkit.recognizeText(fileUri)
    if (recognition.text?.trim()) {
      pageTexts.push(recognition.text)
    }
  }

  const text = pageTexts.join('\n\n')
  console.info('[receipt-scan] ocr text', text)
  const parsed = parseReceiptText(text, options?.kind ?? 'receipt', {
    userFingerprints: options?.userFingerprints,
  })

  return {
    text,
    supplier: parsed.supplier,
    date: parsed.date,
    amount: parsed.amount,
    invoiceNumber: parsed.invoiceNumber,
    nameCandidates: parsed.nameCandidates,
    nameNeedsConfirm: parsed.nameNeedsConfirm,
  }
}
