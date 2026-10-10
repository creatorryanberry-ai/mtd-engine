import { prepareReceiptImageForUpload } from '~/features/mtd/receipt/prepareReceiptImage'
import { parseLandlordStatementText } from '~/features/mtd/receipt/parseLandlordStatementText'
import { ensureRasterReceiptAsset } from '~/features/mtd/receipt/ensureRasterReceiptAsset'
import { reportReceiptStabilizeFailed } from '~/features/mtd/receipt/receiptUploadAnalytics'
import {
  isReceiptOcrAvailable,
  recognizeReceiptFromUri,
} from '~/features/mtd/receipt/recognizeReceiptText'
import { pickReceiptDocument } from '~/helpers/media/documentPicker'
import { pickImageFromLibrary, takePhotoWithCamera } from '~/helpers/media/imagePicker'
import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { isNativeUploadFile } from '~/interface/upload/nativeUploadFile'
import { showToast } from '~/interface/toast/helpers'
import { uploadReceiptFileData } from '~/interface/upload/uploadFile'
import {
  isReceiptScanUiAvailable,
  type ReceiptPickSource,
  type ReceiptScanAsset,
} from './scanReceipt'

export type LandlordStatementDraft = {
  lettingAgent: string
  date: string | null
  grossRents: string | null
  expenses: string | null
  vatOnExpenses: string | null
  localImageUri: string
  attachmentUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  ocrText?: string | null
}

type PickedAsset = ReceiptScanAsset

async function stabilizeUri(asset: PickedAsset): Promise<{
  localImageUri: string
  preparedFile: File | null
}> {
  try {
    const prepared = await prepareReceiptImageForUpload({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    })
    const localImageUri = isNativeUploadFile(prepared) ? prepared.uri : asset.uri
    return { localImageUri, preparedFile: prepared }
  } catch (error) {
    reportReceiptStabilizeFailed(error, 'scan_early')
    return { localImageUri: asset.uri, preparedFile: null }
  }
}

async function tryUploadPrepared(prepared: File): Promise<string | null> {
  try {
    const response = await uploadReceiptFileData(prepared, () => {}, {
      source: 'scan_early',
    })
    return response.attachmentRef ?? response.url ?? null
  } catch {
    return null
  }
}

async function recognizeLandlordText(asset: PickedAsset): Promise<{
  text: string
  parsed: ReturnType<typeof parseLandlordStatementText>
}> {
  if (
    !isRasterImageAsset({
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      uri: asset.uri,
    })
  ) {
    return { text: '', parsed: parseLandlordStatementText('') }
  }

  if (!isReceiptOcrAvailable()) {
    console.info('[landlord-statement-scan] ocr unavailable')
    return { text: '', parsed: parseLandlordStatementText('') }
  }

  try {
    const result = await recognizeReceiptFromUri(asset.uri, {
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    })
    const parsed = parseLandlordStatementText(result.text)
    console.info('[landlord-statement-scan] parsed', parsed)
    return { text: result.text, parsed }
  } catch (error) {
    console.info('[landlord-statement-scan] ocr failed', error)
    return { text: '', parsed: parseLandlordStatementText('') }
  }
}

async function pickStatementAsset(
  source: ReceiptPickSource,
): Promise<PickedAsset | null> {
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

export { isReceiptScanUiAvailable as isLandlordStatementScanUiAvailable }

export async function scanLandlordStatementFromAsset(
  asset: ReceiptScanAsset,
  options?: {
    onScanning?: () => void
    onScanningDone?: () => void
    ocrText?: string
  },
): Promise<LandlordStatementDraft> {
  options?.onScanning?.()

  try {
    // pdf → jpeg first so preview, upload, and ocr all share one image
    const rasterAsset = await ensureRasterReceiptAsset(asset)
    const stabilized = await stabilizeUri(rasterAsset)
    const uploadPromise = stabilized.preparedFile
      ? tryUploadPrepared(stabilized.preparedFile)
      : Promise.resolve(null)

    // keep upload in flight but never leave a rejection unhandled after race timeout
    void uploadPromise.catch((error) => {
      console.info('[landlord-statement-scan] upload failed', error)
    })

    const canOcr =
      isReceiptOcrAvailable() &&
      isRasterImageAsset({
        mimeType: rasterAsset.mimeType,
        fileName: rasterAsset.fileName,
        uri: rasterAsset.uri,
      })
    const recognized =
      options?.ocrText != null
        ? {
            text: options.ocrText,
            parsed: parseLandlordStatementText(options.ocrText),
          }
        : await recognizeLandlordText({
            ...rasterAsset,
            uri: stabilized.localImageUri,
          })
    const parsed = recognized.parsed
    const attachmentUrl = await Promise.race([
      uploadPromise,
      new Promise<string | null>((resolve) => {
        setTimeout(() => resolve(null), 1_500)
      }),
    ])

    if (
      !parsed.lettingAgent &&
      !parsed.grossRents &&
      !parsed.expenses &&
      !parsed.vatOnExpenses
    ) {
      showToast(canOcr ? 'Could not read statement' : 'File attached', {
        type: 'warn',
        message: 'Enter letting agent and amounts manually.',
      })
    }

    return {
      lettingAgent: parsed.lettingAgent ?? '',
      date: parsed.date,
      grossRents: parsed.grossRents,
      expenses: parsed.expenses,
      vatOnExpenses: parsed.vatOnExpenses,
      localImageUri: stabilized.localImageUri,
      attachmentUrl,
      fileName: rasterAsset.fileName ?? null,
      mimeType: rasterAsset.mimeType ?? null,
      ocrText: recognized.text || null,
    }
  } finally {
    options?.onScanningDone?.()
  }
}

export async function scanLandlordStatementWithPicker(
  source: ReceiptPickSource,
  options?: {
    onScanning?: () => void
    onScanningDone?: () => void
  },
): Promise<LandlordStatementDraft | null> {
  const asset = await pickStatementAsset(source)
  if (!asset) {
    return null
  }

  return scanLandlordStatementFromAsset(asset, options)
}
