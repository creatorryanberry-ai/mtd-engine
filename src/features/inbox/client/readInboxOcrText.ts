import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { ensureRasterReceiptAsset } from '~/features/mtd/receipt/ensureRasterReceiptAsset'
import { prepareReceiptImageForUpload } from '~/features/mtd/receipt/prepareReceiptImage'
import {
  isReceiptOcrAvailable,
  recognizeReceiptFromUri,
} from '~/features/mtd/receipt/recognizeReceiptText'
import { isNativeUploadFile } from '~/interface/upload/nativeUploadFile'
import type { ReceiptScanAsset } from '~/features/mtd/receipt/scanReceipt'

async function stabilizeInboxRasterAsset(
  asset: ReceiptScanAsset,
): Promise<ReceiptScanAsset> {
  if (
    !isRasterImageAsset({
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      uri: asset.uri,
    })
  ) {
    return asset
  }

  try {
    const prepared = await prepareReceiptImageForUpload({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    })
    if (!isNativeUploadFile(prepared)) {
      return asset
    }
    return {
      ...asset,
      uri: prepared.uri,
      fileName: prepared.name || asset.fileName,
      mimeType: prepared.type || asset.mimeType,
    }
  } catch (error) {
    console.info('[inbox] stabilize asset failed', error)
    return asset
  }
}

export async function readInboxOcrText(asset: ReceiptScanAsset) {
  let rasterAsset = asset
  try {
    rasterAsset = await ensureRasterReceiptAsset(asset)
  } catch (error) {
    console.info('[inbox] pdf rasterize failed', error)
  }
  rasterAsset = await stabilizeInboxRasterAsset(rasterAsset)

  if (
    !isReceiptOcrAvailable() ||
    !isRasterImageAsset({
      mimeType: rasterAsset.mimeType,
      fileName: rasterAsset.fileName,
      uri: rasterAsset.uri,
    })
  ) {
    return { rasterAsset, text: '' }
  }

  try {
    const result = await recognizeReceiptFromUri(rasterAsset.uri, {
      mimeType: rasterAsset.mimeType,
      fileName: rasterAsset.fileName,
    })
    return { rasterAsset, text: result.text }
  } catch (error) {
    console.info('[inbox] ocr failed', error)
    return { rasterAsset, text: '' }
  }
}
