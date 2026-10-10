export async function downloadInboxAsset(
  url: string,
  fileName: string,
  mimeType?: string | null,
) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Could not download document')
  }
  const blob = await response.blob()
  const uri = URL.createObjectURL(blob)
  return {
    uri,
    fileName,
    mimeType: mimeType || blob.type || undefined,
  }
}
