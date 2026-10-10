import { File, Paths } from 'expo-file-system'
import ExpoPdfToImage from 'expo-pdf-to-image'

import { isPdfAsset } from '~/helpers/media/isRasterImageAsset'

const DEFAULT_MAX_PDF_PAGES = 2

function toFileUri(path: string) {
  const trimmed = path.trim()
  if (trimmed.startsWith('file://')) return trimmed
  if (trimmed.startsWith('/')) return `file://${trimmed}`
  return trimmed
}

function copyPageToUniqueCache(sourcePath: string, pageIndex: number) {
  const source = new File(toFileUri(sourcePath))
  const dest = new File(
    Paths.cache,
    `pdf-ocr-${Date.now()}-${pageIndex}-${Math.random().toString(36).slice(2, 8)}.jpg`,
  )
  source.copy(dest)
  return dest.uri
}

/** images pass through; pdfs render first pages to cache jpegs for mlkit */
export async function resolveOcrImageUris(options: {
  uri: string
  mimeType?: string | null
  fileName?: string | null
  maxPages?: number
}): Promise<string[]> {
  if (
    !isPdfAsset({
      mimeType: options.mimeType,
      fileName: options.fileName,
      uri: options.uri,
    })
  ) {
    return [options.uri]
  }

  const maxPages = options.maxPages ?? DEFAULT_MAX_PDF_PAGES
  console.info('[receipt-scan] rendering pdf for ocr', {
    uriPrefix: options.uri.slice(0, 48),
    maxPages,
  })

  const pagePaths = await ExpoPdfToImage.convertPdfToImages(options.uri)
  const limited = pagePaths.slice(0, Math.max(1, maxPages))
  if (limited.length === 0) {
    throw new Error('PDF has no pages to OCR')
  }

  // expo-pdf-to-image always writes pdf_page_N.jpg — copy so previews aren't stale
  return limited.map((path, pageIndex) => copyPageToUniqueCache(path, pageIndex))
}
