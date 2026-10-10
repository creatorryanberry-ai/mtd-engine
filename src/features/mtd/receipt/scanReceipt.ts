import { Platform } from 'react-native'
import { isWeb } from 'tamagui'

import { pickReceiptDocument } from '~/helpers/media/documentPicker'
import { pickImageFromLibrary, takePhotoWithCamera } from '~/helpers/media/imagePicker'
import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { ensureRasterReceiptAsset } from '~/features/mtd/receipt/ensureRasterReceiptAsset'
import { prepareReceiptImageForUpload } from '~/features/mtd/receipt/prepareReceiptImage'
import { reportReceiptStabilizeFailed } from '~/features/mtd/receipt/receiptUploadAnalytics'
import {
  isReceiptOcrAvailable,
  recognizeReceiptFromUri,
} from '~/features/mtd/receipt/recognizeReceiptText'
import {
  parseReceiptText,
  type ReceiptDocumentKind,
} from '~/features/mtd/receipt/parseReceiptText'
import type { UserMerchantFingerprint } from '~/features/mtd/receipt/merchant'
import { isNativeUploadFile } from '~/interface/upload/nativeUploadFile'
import { uploadReceiptFileData } from '~/interface/upload/uploadFile'
import { showToast } from '~/interface/toast/helpers'

export type ReceiptPickSource = 'camera' | 'library' | 'file'

export type ManualReceiptDraft = {
  name: string
  /** immutable copy of the initial OCR/resolver suggestion */
  suggestedName?: string
  details: string
  date: string | null
  amount: string | null
  localImageUri: string
  attachmentUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  /** true when bill-to customer was ambiguous — name may be empty or a guess */
  nameNeedsConfirm?: boolean
  /** raw ocr text for fingerprint learning on corrected saves */
  ocrText?: string | null
  documentKind?: ReceiptDocumentKind
  /** remembered private-use % from a matching fingerprint (receipt expenses) */
  privateUsePercent?: number | null
}

export type ReceiptScanAsset = {
  uri: string
  fileName?: string | null
  mimeType?: string
  fileSize?: number
}

const emptyParsed = {
  text: '' as string,
  supplier: null as string | null,
  date: null as string | null,
  amount: null as string | null,
  invoiceNumber: null as string | null,
  nameCandidates: [] as string[],
  nameNeedsConfirm: false,
}

export async function assetToFile(asset: ReceiptScanAsset): Promise<File> {
  const fileName = asset.fileName || `receipt-${Date.now()}.jpg`
  const mimeType = asset.mimeType || 'image/jpeg'

  if (isWeb) {
    const response = await fetch(asset.uri)
    const blob = await response.blob()
    return new File([blob], fileName, { type: mimeType })
  }

  // only uri/name/type — extra fields break rn multipart uploads on device
  return {
    uri: asset.uri,
    name: fileName,
    type: mimeType,
  } as unknown as File
}

/** copy/recompress into app cache so camera temp uris can't vanish before save */
async function stabilizeReceiptUri(asset: ReceiptScanAsset): Promise<{
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
    // already reported inside uploadReceiptFileData
    return null
  }
}

export function isReceiptScanUiAvailable() {
  return Platform.OS !== 'web'
}

async function recognizeAsset(
  asset: ReceiptScanAsset,
  kind: ReceiptDocumentKind,
  userFingerprints?: UserMerchantFingerprint[],
) {
  if (
    !isRasterImageAsset({
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      uri: asset.uri,
    })
  ) {
    return emptyParsed
  }

  if (!isReceiptOcrAvailable()) {
    return emptyParsed
  }

  try {
    return await recognizeReceiptFromUri(asset.uri, {
      kind,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      userFingerprints,
    })
  } catch (error) {
    console.info('[receipt-scan] ocr failed', error)
    return emptyParsed
  }
}

async function pickReceiptAsset(
  source: ReceiptPickSource,
): Promise<ReceiptScanAsset | null> {
  if (source === 'file') {
    const result = await pickReceiptDocument()
    if (!result || result.canceled || !result.assets?.[0]) return null
    const asset = result.assets[0]
    return {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      fileSize: asset.size,
    }
  }

  const picker = source === 'camera' ? takePhotoWithCamera : pickImageFromLibrary
  const result = await picker(false)
  if (!result || result.canceled || !result.assets?.[0]) return null
  return result.assets[0]
}

function detailsFromInvoiceNumber(invoiceNumber: string | null) {
  if (!invoiceNumber) return ''
  return `Invoice #${invoiceNumber}`
}

export async function scanReceiptFromAsset(
  asset: ReceiptScanAsset,
  options?: {
    onScanning?: () => void
    onScanningDone?: () => void
    kind?: ReceiptDocumentKind
    ocrText?: string
    userFingerprints?: UserMerchantFingerprint[]
  },
): Promise<ManualReceiptDraft> {
  const kind = options?.kind ?? 'receipt'
  options?.onScanning?.()

  try {
    const rasterAsset = await ensureRasterReceiptAsset(asset)
    // stabilize first so ocr + later save use a durable cache jpeg (not camera temp)
    const stabilized = await stabilizeReceiptUri(rasterAsset)
    const ocrAsset = { ...rasterAsset, uri: stabilized.localImageUri }
    const canOcr =
      isReceiptOcrAvailable() &&
      isRasterImageAsset({
        mimeType: rasterAsset.mimeType,
        fileName: rasterAsset.fileName,
        uri: rasterAsset.uri,
      })

    const uploadPromise = stabilized.preparedFile
      ? tryUploadPrepared(stabilized.preparedFile)
      : Promise.resolve(null)

    const parsed =
      options?.ocrText != null
        ? {
            text: options.ocrText,
            ...parseReceiptText(options.ocrText, kind, {
              userFingerprints: options.userFingerprints,
            }),
          }
        : await recognizeAsset(ocrAsset, kind, options?.userFingerprints)
    // give upload a short grace after ocr; save-time fallback covers the rest
    const attachmentUrl = await Promise.race([
      uploadPromise,
      new Promise<string | null>((resolve) => {
        setTimeout(() => resolve(null), 1_500)
      }),
    ])

    let name = parsed.supplier ?? ''
    let nameNeedsConfirm = false

    if (kind === 'invoice' && parsed.nameNeedsConfirm) {
      nameNeedsConfirm = true
      // prefer first candidate; leave blank if none — never block the add form
      name = parsed.nameCandidates[0] ?? ''
    } else if (!parsed.supplier && !parsed.date && !parsed.amount) {
      showToast(canOcr ? 'Could not read details' : 'File attached', {
        type: 'warn',
        message: 'Enter name, date, and amount manually.',
      })
    }

    return {
      name,
      suggestedName: name,
      details: detailsFromInvoiceNumber(parsed.invoiceNumber),
      date: parsed.date,
      amount: parsed.amount,
      localImageUri: stabilized.localImageUri,
      attachmentUrl,
      fileName: rasterAsset.fileName ?? null,
      mimeType: rasterAsset.mimeType ?? null,
      nameNeedsConfirm,
      ocrText: parsed.text || options?.ocrText || null,
      documentKind: kind,
    }
  } finally {
    options?.onScanningDone?.()
  }
}

export async function scanReceiptWithPicker(
  source: ReceiptPickSource,
  options?: {
    onScanning?: () => void
    onScanningDone?: () => void
    kind?: ReceiptDocumentKind
    userFingerprints?: UserMerchantFingerprint[]
  },
): Promise<ManualReceiptDraft | null> {
  const asset = await pickReceiptAsset(source)
  if (!asset) {
    return null
  }

  return scanReceiptFromAsset(asset, options)
}
