import type {
  RecognizeReceiptOptions,
  RecognizeReceiptResult,
} from './recognizeReceiptText.types'

export type { RecognizeReceiptOptions, RecognizeReceiptResult }

export function isReceiptOcrAvailable() {
  return false
}

export async function recognizeReceiptFromUri(
  _uri: string,
  _options?: RecognizeReceiptOptions,
): Promise<RecognizeReceiptResult> {
  throw new Error('Receipt OCR is only available on iOS and Android')
}
