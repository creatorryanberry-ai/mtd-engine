import { File, Paths } from 'expo-file-system'

function inboxCacheFileName(fileName: string) {
  const match = fileName.toLowerCase().match(/(\.[a-z0-9]{1,8})$/)
  const ext = match?.[1] ?? ''
  return `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
}

export async function downloadInboxAsset(
  url: string,
  fileName: string,
  mimeType?: string | null,
) {
  const dest = new File(Paths.cache, inboxCacheFileName(fileName))
  const file = await File.downloadFileAsync(url, dest, { idempotent: true })
  return {
    uri: file.uri,
    fileName,
    mimeType: mimeType || undefined,
  }
}
