import { AbortError, createGlobalContext, IS_WEB, useAsyncEffect } from '@mtd/helpers'
import { useContext, useEffect, useState } from 'react'
import { useEvent } from 'tamagui'
import { API_URL } from '~/constants/urls'
import { authState } from '~/features/auth/client/authClient'
import {
  reportReceiptUploadFailed,
  reportReceiptUploadStarted,
  reportReceiptUploadSucceeded,
  type ReceiptUploadSource,
} from '~/features/mtd/receipt/receiptUploadAnalytics'
import { showToast } from '~/interface/toast/Toast'

import { getFileType, isImageFile, isVideoFile, validateFile } from './helpers'
import {
  isNativeUploadFile,
  toNativeUploadFile,
  uploadNativeFile,
} from './nativeUploadFile'
import { prepareImageForUpload } from './resizeImage'

import type { FileUpload } from './types'
import type React from 'react'

interface UploadResponse {
  url?: string
  key?: string
  attachmentRef?: string
  error?: string
  thumbnail?: string | null
}

export const uploadEndpoint = `${API_URL}/file/upload`
export const receiptUploadEndpoint = `${API_URL}/file/receipt`

function postUploadXhr(
  endpoint: string,
  fileData: File | Blob,
  onProgress: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    // rn formdata only accepts {uri,name,type} for files — never append extra fields
    if (isNativeUploadFile(fileData)) {
      const native = toNativeUploadFile(fileData)
      formData.append('file', native as unknown as Blob)
    } else {
      formData.append('file', fileData)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint)
    xhr.timeout = 60_000

    const sessionToken = authState.value?.session?.token
    if (sessionToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded * 100) / event.total))
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response: UploadResponse = JSON.parse(xhr.response)
          resolve(response)
        } catch (e) {
          reject(new Error('Failed to parse server response.', { cause: e }))
        }
      } else {
        let errorMessage = `Upload failed with status: ${xhr.status}`
        try {
          const errorResponse = JSON.parse(xhr.response)
          if (errorResponse.error) {
            errorMessage = errorResponse.error
          }
        } catch {
          // use default error message
        }
        reject(new Error(errorMessage))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Upload error: An error occurred while uploading the file.'))
    }

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. Check your connection and try again.'))
    }

    xhr.send(formData)
  })
}

async function postUpload(
  endpoint: string,
  fileData: File | Blob,
  onProgress: (percent: number) => void,
): Promise<UploadResponse> {
  // physical devices hang on xhr+formdata file uploads; use native multipart
  if (!IS_WEB && isNativeUploadFile(fileData)) {
    onProgress(10)
    const response = await uploadNativeFile(endpoint, toNativeUploadFile(fileData))
    onProgress(100)
    return response
  }

  return postUploadXhr(endpoint, fileData, onProgress)
}

export function uploadFileData(
  fileData: File | Blob,
  onProgress: (percent: number) => void,
): Promise<UploadResponse> {
  return postUpload(uploadEndpoint, fileData, onProgress)
}

export async function uploadReceiptFileData(
  fileData: File | Blob,
  onProgress: (percent: number) => void,
  options?: { source?: ReceiptUploadSource },
): Promise<UploadResponse> {
  const source = options?.source ?? 'unknown'
  const startedAt = Date.now()
  reportReceiptUploadStarted(source, fileData)
  try {
    const response = await postUpload(receiptUploadEndpoint, fileData, onProgress)
    reportReceiptUploadSucceeded(source, {
      hasAttachmentRef: Boolean(response.attachmentRef),
      hasUrl: Boolean(response.url),
      durationMs: Date.now() - startedAt,
      file: fileData,
    })
    return response
  } catch (error) {
    reportReceiptUploadFailed(source, error, {
      durationMs: Date.now() - startedAt,
      file: fileData,
    })
    throw error
  }
}

type UploadFilesContextType = {
  uploads: FileUpload[]
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleUpload: (files: File[]) => void
}

export type UploadFilesCallback = (uploads: FileUpload[]) => void

const context = createGlobalContext<UploadFilesContextType | null>('upload/files', null)

export const ProvideUploadFiles = context.Provider

export const useParentUploadFiles = () => {
  const ctx = useContext(context)
  if (!ctx) {
    throw new Error('useParentUploadFiles must be used within ProvideUploadFiles')
  }
  return ctx
}

const defaultResize = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 1,
  maxSizeInBytes: 1024 * 1024,
}

export const useUploadFiles = ({
  onChange,
  resize = defaultResize,
  purpose = 'public',
}: {
  onChange?: UploadFilesCallback
  resize?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    maxSizeInBytes?: number
  }
  purpose?: 'public' | 'receipt'
}) => {
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [uploadsToProcess, setUploadsToProcess] = useState<FileUpload[]>([])
  const onChangeEvent = useEvent(onChange)

  useEffect(() => {
    onChangeEvent?.(uploads)
  }, [uploads, onChangeEvent])

  const clear = () => {
    setUploads([])
    setUploadsToProcess([])
  }

  const getFileId = (file: File) =>
    `${file.name}-${file.type}-${file.lastModified}-${file.size}`

  const handleUpload = (files: File[]) => {
    const fakeEvent = {
      target: {
        files,
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>

    handleFileChange(fakeEvent)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) {
      setUploads([])
      setUploadsToProcess([])
      return
    }

    function getUpload(upload: File): FileUpload {
      const validation = validateFile(upload)
      // check if it's a native pseudo-file with uri property
      const isNativeFile = !IS_WEB && typeof (upload as any).uri === 'string'
      return {
        uid: getFileId(upload),
        name: upload.name,
        type: getFileType(upload.type || upload.name),
        file: upload,
        size: upload.size,
        progress: 0,
        ...(validation.valid
          ? {
              status: 'uploading' as const,
              preview:
                isImageFile(upload.name) || isVideoFile(upload.name)
                  ? isNativeFile
                    ? (upload as any).uri // use uri for native
                    : URL.createObjectURL(upload) // use blob url for web
                  : undefined,
            }
          : {
              status: 'error',
              error: validation.error,
            }),
      }
    }

    const newUploads = files.map(getUpload)

    // show toast for any validation errors
    for (const upload of newUploads) {
      if (upload.status === 'error' && upload.error) {
        showToast(upload.error, { type: 'error' })
      }
    }

    setUploads(newUploads)
    const toProcess = newUploads.filter((u) => u.status === 'uploading' && u.file)
    setUploadsToProcess(toProcess)
  }

  useAsyncEffect(
    async (signal) => {
      if (uploadsToProcess.length === 0) return

      const updateFile = (uid: string, updates: Partial<FileUpload>) => {
        if (signal.aborted) {
          throw new AbortError('Operation aborted')
        }

        setUploads((current) =>
          current.map((u) => (u.uid === uid ? { ...u, ...updates } : u)),
        )
      }

      for (const upload of uploadsToProcess) {
        if (signal.aborted) break

        try {
          let processedFile: File | Blob = upload.file!

          if (isImageFile(upload.name)) {
            if (purpose === 'receipt') {
              // lazy import avoids cycle: uploadFile ↔ prepareReceiptImage ↔ scanReceipt
              const { prepareReceiptImageForUpload } =
                await import('~/features/mtd/receipt/prepareReceiptImage')
              const uri = isNativeUploadFile(upload.file)
                ? upload.file.uri
                : upload.preview
              if (uri) {
                processedFile = await prepareReceiptImageForUpload({
                  uri,
                  fileName: upload.name,
                })
              } else if (IS_WEB) {
                processedFile = await prepareImageForUpload(upload, resize)
              }
            } else if (IS_WEB) {
              processedFile = await prepareImageForUpload(upload, resize)
            }
          }

          if (signal.aborted) throw new AbortError('Upload cancelled')

          const response =
            purpose === 'receipt'
              ? await uploadReceiptFileData(
                  processedFile,
                  (progress) => {
                    updateFile(upload.uid, { progress, status: 'uploading' })
                  },
                  { source: 'upload_files' },
                )
              : await uploadFileData(processedFile, (progress) => {
                  updateFile(upload.uid, { progress, status: 'uploading' })
                })

          if (signal.aborted) throw new AbortError('Upload cancelled')

          if (response.url || response.attachmentRef) {
            updateFile(upload.uid, {
              url: response.url,
              attachmentRef: response.attachmentRef,
              thumbnail: response.thumbnail,
              status: 'complete',
            })
          } else {
            updateFile(upload.uid, {
              error: response.error,
              status: 'error',
            })
          }
        } catch (err) {
          if (err instanceof AbortError) {
            if (process.env.NODE_ENV === 'development') {
              console.info('Upload aborted')
            }
            break
          }

          const errorMessage = err instanceof Error ? err.message : `${err}`
          showToast(errorMessage, { type: 'error' })
          updateFile(upload.uid, {
            error: errorMessage,
            status: 'error',
          })
        }
      }
    },
    [uploadsToProcess, JSON.stringify(resize), purpose],
  )

  return {
    uploads,
    handleUpload,
    handleFileChange,
    clear,
  }
}
