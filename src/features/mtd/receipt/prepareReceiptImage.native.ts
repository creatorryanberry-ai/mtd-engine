import { Image } from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'

import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'

import {
  RECEIPT_IMAGE_MAX_EDGE,
  RECEIPT_JPEG_QUALITY,
  type ReceiptImageSource,
} from './receiptImageOptions'

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error ?? new Error('Failed to read image size')),
    )
  })
}

function toNativeUploadFile(source: ReceiptImageSource): File {
  const ext = source.fileName?.includes('.')
    ? ''
    : source.mimeType === 'application/pdf'
      ? '.pdf'
      : ''
  const name = source.fileName || `receipt-${Date.now()}${ext}`
  return {
    uri: source.uri,
    name,
    type: source.mimeType || 'application/octet-stream',
  } as unknown as File
}

/**
 * resize receipt to screen size via image manipulator and write a stable cache jpeg.
 * camera/picker temp uris can vanish on device — always return the manipulator output uri.
 * pdfs / non-images are returned as-is (document picker already copies to cache).
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
    return toNativeUploadFile(source)
  }

  const fileName = (source.fileName || `receipt-${Date.now()}.jpg`).replace(
    /\.\w+$/,
    '.jpg',
  )

  let actions: ImageManipulator.Action[] = []
  try {
    const { width, height } = await getImageSize(source.uri)
    const max = RECEIPT_IMAGE_MAX_EDGE
    if (width > max || height > max) {
      actions =
        width >= height ? [{ resize: { width: max } }] : [{ resize: { height: max } }]
    }
  } catch {
    // still recompress even if size read fails
    actions = [{ resize: { width: RECEIPT_IMAGE_MAX_EDGE } }]
  }

  console.info('[receipt-scan] prepare image', {
    uriPrefix: source.uri.slice(0, 48),
    actions: actions.length,
  })

  const result = await ImageManipulator.manipulateAsync(source.uri, actions, {
    compress: RECEIPT_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  // only uri/name/type — rn formdata / expo uploadAsync reject extra file fields
  return {
    uri: result.uri,
    name: fileName,
    type: 'image/jpeg',
  } as unknown as File
}
