/** web: no pdf render — return the original uri (ocr unavailable on web anyway) */
export async function resolveOcrImageUris(options: {
  uri: string
  mimeType?: string | null
  fileName?: string | null
  maxPages?: number
}): Promise<string[]> {
  return [options.uri]
}
