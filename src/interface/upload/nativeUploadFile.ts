export type NativeUploadFile = {
  uri: string
  name: string
  type: string
}

export function isNativeUploadFile(file: unknown): file is NativeUploadFile {
  if (!file || typeof file !== 'object') return false
  const candidate = file as { uri?: unknown }
  return typeof candidate.uri === 'string' && candidate.uri.length > 0
}

export function toNativeUploadFile(
  file: NativeUploadFile | { uri: string; name?: string; type?: string },
  fallbackName = `upload-${Date.now()}.jpg`,
): NativeUploadFile {
  return {
    uri: file.uri,
    name: file.name || fallbackName,
    type: file.type || 'image/jpeg',
  }
}

/** web never uses native multipart — callers branch on isNativeUploadFile + IS_WEB */
export async function uploadNativeFile(
  _endpoint: string,
  _file: NativeUploadFile,
): Promise<never> {
  throw new Error('Native multipart upload is not available on web')
}
