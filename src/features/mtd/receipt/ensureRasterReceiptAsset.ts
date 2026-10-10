import { isPdfAsset } from '~/helpers/media/isRasterImageAsset'

import { resolveOcrImageUris } from './resolveOcrImageUris'

export type RasterizableAsset = {
  uri: string
  fileName?: string | null
  mimeType?: string
  fileSize?: number
}

/**
 * convert pdfs to a first-page jpeg so preview, upload, and ocr all use an image.
 * non-pdfs pass through unchanged.
 */
export async function ensureRasterReceiptAsset<T extends RasterizableAsset>(
  asset: T,
): Promise<T> {
  if (
    !isPdfAsset({
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      uri: asset.uri,
    })
  ) {
    return asset
  }

  const [pageUri] = await resolveOcrImageUris({
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileName: asset.fileName,
    maxPages: 1,
  })
  if (!pageUri) {
    throw new Error('PDF has no pages to convert')
  }

  const baseName = (asset.fileName || 'document').replace(/\.pdf$/i, '') || 'document'
  console.info('[receipt-scan] pdf rasterized for preview/upload', {
    fromPrefix: asset.uri.slice(0, 48),
    toPrefix: pageUri.slice(0, 48),
  })

  return {
    ...asset,
    uri: pageUri,
    fileName: `${baseName}.jpg`,
    mimeType: 'image/jpeg',
  }
}
