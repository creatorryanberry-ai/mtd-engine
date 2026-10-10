import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { resizeImage } from '~/interface/upload/resizeImage'

import {
  RECEIPT_DPI,
  RECEIPT_IMAGE_MAX_EDGE,
  RECEIPT_JPEG_QUALITY,
  type ReceiptImageSource,
} from './receiptImageOptions'
import { assetToFile } from './scanReceipt'

/** set jfif density so viewers treat the jpeg as 72dpi screen imagery */
function setJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    // soi + app0 jfif
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob
    if (bytes[2] !== 0xff || bytes[3] !== 0xe0) return blob
    // 'JFIF\0' at offset 6
    if (
      bytes[6] !== 0x4a ||
      bytes[7] !== 0x46 ||
      bytes[8] !== 0x49 ||
      bytes[9] !== 0x46 ||
      bytes[10] !== 0x00
    ) {
      return blob
    }
    // units: 1 = dpi; x/y density big-endian at 14..17
    bytes[13] = 1
    bytes[14] = (dpi >> 8) & 0xff
    bytes[15] = dpi & 0xff
    bytes[16] = (dpi >> 8) & 0xff
    bytes[17] = dpi & 0xff
    return new Blob([bytes], { type: 'image/jpeg' })
  })
}

/**
 * canvas-resize receipt to screen size (72dpi-oriented), always recompress as jpeg.
 * web implementation — native uses expo-image-manipulator.
 * pdfs / non-images are returned as-is.
 */
export async function prepareReceiptImageForUpload(
  source: ReceiptImageSource,
): Promise<File> {
  if (
    !isRasterImageAsset({
      mimeType: source.mimeType,
      fileName: source.fileName,
      uri: source.uri,
    })
  ) {
    return assetToFile(source)
  }

  const file = await assetToFile(source)
  const fileName = (source.fileName || file.name || `receipt-${Date.now()}.jpg`).replace(
    /\.\w+$/,
    '.jpg',
  )

  // force jpeg encode via canvas (file.type drives toBlob mime)
  const jpegSource = new File([file], fileName, { type: 'image/jpeg' })
  const resized = await resizeImage(jpegSource, {
    maxWidth: RECEIPT_IMAGE_MAX_EDGE,
    maxHeight: RECEIPT_IMAGE_MAX_EDGE,
    quality: RECEIPT_JPEG_QUALITY,
  })
  const withDpi = await setJpegDpi(resized, RECEIPT_DPI)
  return new File([withDpi], fileName, { type: 'image/jpeg' })
}
