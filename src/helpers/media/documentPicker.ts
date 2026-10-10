import * as DocumentPicker from 'expo-document-picker'

export type PickedDocumentAsset = {
  uri: string
  name: string | null
  mimeType: string | undefined
  size: number | undefined
  fileName: string | null
}

export type DocumentPickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: PickedDocumentAsset[] }

/** pdf + common receipt/invoice image types from files / downloads / drive */
export const RECEIPT_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export async function pickDocument(
  type: string | string[] = [...RECEIPT_DOCUMENT_TYPES],
): Promise<DocumentPickerResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type,
    copyToCacheDirectory: true,
    multiple: false,
  })

  if (result.canceled || !result.assets?.[0]) {
    return { canceled: true, assets: null }
  }

  return {
    canceled: false,
    assets: result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name ?? null,
      mimeType: asset.mimeType,
      size: asset.size ?? undefined,
      fileName: asset.name ?? null,
    })),
  }
}

export async function pickReceiptDocument(): Promise<DocumentPickerResult | null> {
  return pickDocument([...RECEIPT_DOCUMENT_TYPES])
}
