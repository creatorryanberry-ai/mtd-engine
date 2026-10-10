const RASTER_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
]

/** true when the asset can be resized / ocr'd as a bitmap (not pdf/docs) */
export function isRasterImageAsset(options: {
  mimeType?: string | null
  fileName?: string | null
  uri?: string | null
}): boolean {
  const mime = options.mimeType?.toLowerCase().trim() ?? ''
  if (mime.startsWith('image/') && !mime.includes('svg')) {
    return true
  }

  const name = (options.fileName || options.uri || '').toLowerCase()
  const path = name.split('?')[0] ?? name
  return RASTER_IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext))
}

export function isPdfAsset(options: {
  mimeType?: string | null
  fileName?: string | null
  uri?: string | null
}): boolean {
  const mime = options.mimeType?.toLowerCase().trim() ?? ''
  if (mime === 'application/pdf') return true

  const name = (options.fileName || options.uri || '').toLowerCase()
  const path = name.split('?')[0] ?? name
  return path.endsWith('.pdf')
}
