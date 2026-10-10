import { prepareReceiptImageForUpload } from '~/features/mtd/receipt/prepareReceiptImage'
import { parseCisVoucherText } from '~/features/mtd/receipt/parseCisVoucherText'
import { ensureRasterReceiptAsset } from '~/features/mtd/receipt/ensureRasterReceiptAsset'
import {
  isReceiptOcrAvailable,
  recognizeReceiptFromUri,
} from '~/features/mtd/receipt/recognizeReceiptText'
import { pickReceiptDocument } from '~/helpers/media/documentPicker'
import { pickImageFromLibrary, takePhotoWithCamera } from '~/helpers/media/imagePicker'
import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { isNativeUploadFile } from '~/interface/upload/nativeUploadFile'
import { showToast } from '~/interface/toast/helpers'
import {
  isReceiptScanUiAvailable,
  type ReceiptPickSource,
  type ReceiptScanAsset,
} from './scanReceipt'

export type CisVoucherDraft = {
  customer: string
  date: string | null
  gross: string | null
  tax: string | null
  ocrText?: string | null
}

type PickedAsset = ReceiptScanAsset

async function stabilizeUri(asset: PickedAsset): Promise<string> {
  try {
    const prepared = await prepareReceiptImageForUpload({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    })
    return isNativeUploadFile(prepared) ? prepared.uri : asset.uri
  } catch {
    return asset.uri
  }
}

async function recognizeCisText(asset: PickedAsset): Promise<{
  text: string
  parsed: ReturnType<typeof parseCisVoucherText>
}> {
  if (
    !isRasterImageAsset({
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      uri: asset.uri,
    })
  ) {
    return { text: '', parsed: parseCisVoucherText('') }
  }

  if (!isReceiptOcrAvailable()) {
    return { text: '', parsed: parseCisVoucherText('') }
  }

  try {
    const result = await recognizeReceiptFromUri(asset.uri, {
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    })
    return { text: result.text, parsed: parseCisVoucherText(result.text) }
  } catch (error) {
    console.info('[cis-voucher-scan] ocr failed', error)
    return { text: '', parsed: parseCisVoucherText('') }
  }
}

async function pickVoucherAsset(source: ReceiptPickSource): Promise<PickedAsset | null> {
  if (source === 'file') {
    const result = await pickReceiptDocument()
    if (!result || result.canceled || !result.assets?.[0]) return null
    const asset = result.assets[0]
    return {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    }
  }

  const picker = source === 'camera' ? takePhotoWithCamera : pickImageFromLibrary
  const result = await picker(false)
  if (!result || result.canceled || !result.assets?.[0]) return null
  return result.assets[0]
}

export { isReceiptScanUiAvailable as isCisVoucherScanUiAvailable }

export async function scanCisVoucherFromAsset(
  asset: ReceiptScanAsset,
  options?: {
    onScanning?: () => void
    onScanningDone?: () => void
    ocrText?: string
  },
): Promise<CisVoucherDraft> {
  options?.onScanning?.()

  try {
    const rasterAsset = await ensureRasterReceiptAsset(asset)
    const localUri = await stabilizeUri(rasterAsset)
    const canOcr =
      isReceiptOcrAvailable() &&
      isRasterImageAsset({
        mimeType: rasterAsset.mimeType,
        fileName: rasterAsset.fileName,
        uri: rasterAsset.uri,
      })
    const recognized =
      options?.ocrText != null
        ? { text: options.ocrText, parsed: parseCisVoucherText(options.ocrText) }
        : await recognizeCisText({ ...rasterAsset, uri: localUri })
    const parsed = recognized.parsed

    if (!parsed.customer && !parsed.gross && !parsed.tax) {
      showToast(canOcr ? 'Could not read voucher' : 'Could not read file', {
        type: 'warn',
        message: 'Enter customer, gross, and tax manually.',
      })
    }

    return {
      customer: parsed.customer ?? '',
      date: parsed.date,
      gross: parsed.gross,
      tax: parsed.tax,
      ocrText: recognized.text || null,
    }
  } finally {
    options?.onScanningDone?.()
  }
}

export async function scanCisVoucherWithPicker(
  source: ReceiptPickSource,
  options?: {
    onScanning?: () => void
    onScanningDone?: () => void
  },
): Promise<CisVoucherDraft | null> {
  const asset = await pickVoucherAsset(source)
  if (!asset) {
    return null
  }

  return scanCisVoucherFromAsset(asset, options)
}
