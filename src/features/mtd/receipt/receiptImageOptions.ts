/** screen-oriented receipt uploads: ~72dpi display size, not camera print dumps */
export const RECEIPT_IMAGE_MAX_EDGE = 1280
export const RECEIPT_JPEG_QUALITY = 0.72
export const RECEIPT_DPI = 72

export type ReceiptImageSource = {
  uri: string
  fileName?: string | null
  mimeType?: string
  fileSize?: number
}
