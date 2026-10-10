import {
  FileSystemSessionType,
  FileSystemUploadType,
  uploadAsync,
} from 'expo-file-system/legacy'

import { authState } from '~/features/auth/client/authClient'

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

type UploadResponse = {
  url?: string
  key?: string
  attachmentRef?: string
  error?: string
  thumbnail?: string | null
}

/**
 * multipart upload via expo-file-system — avoids rn xhr/formdata hangs on device.
 * uses foreground session so dead connections fail instead of retrying forever.
 */
export async function uploadNativeFile(
  endpoint: string,
  file: NativeUploadFile,
): Promise<UploadResponse> {
  const sessionToken = authState.value?.session?.token
  const headers: Record<string, string> = {}
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`
  }

  console.info('[upload] native multipart', {
    endpoint,
    name: file.name,
    type: file.type,
    uriPrefix: file.uri.slice(0, 48),
  })

  const result = await uploadAsync(endpoint, file.uri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: file.type || 'image/jpeg',
    sessionType: FileSystemSessionType.FOREGROUND,
    headers,
  })

  console.info('[upload] native multipart done', { status: result.status })

  if (result.status < 200 || result.status >= 300) {
    let errorMessage = `Upload failed with status: ${result.status}`
    try {
      const errorResponse = JSON.parse(result.body) as { error?: string }
      if (errorResponse.error) errorMessage = errorResponse.error
    } catch {
      // keep default
    }
    throw new Error(errorMessage)
  }

  try {
    return JSON.parse(result.body) as UploadResponse
  } catch (error) {
    throw new Error('Failed to parse server response.', { cause: error })
  }
}
