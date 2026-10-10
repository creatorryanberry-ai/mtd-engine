import { randomId } from '@mtd/helpers'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

import { server } from '~/env'

import { getGcsStorage, isGcsConfigured } from './gcs'
import { getS3Client, isMinioConfigured } from './s3client'
import { defaultBucket } from './storage'
import { parseReceiptRef, toReceiptRef } from './receiptRef'

const SIGNED_URL_TTL_SECONDS = 60 * 60

type ReceiptUploadInput = {
  userId: string
  fileName: string
  body: Buffer | Uint8Array
  contentType: string
  key?: string
}

export type ReceiptUploadResult = {
  key: string
  attachmentRef: string
  url: string
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'receipt'
}

function buildReceiptKey(userId: string, fileName: string) {
  return `receipts/${userId}/${randomId()}-${sanitizeFileName(fileName)}`
}

function isOwnedObjectKey(key: string, userId: string) {
  return key.startsWith(`receipts/${userId}/`) || key.startsWith(`inbox/${userId}/`)
}

async function getS3SignedGetUrl(key: string) {
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
  const sign = getSignedUrl as (
    client: unknown,
    command: unknown,
    options: { expiresIn: number },
  ) => Promise<string>
  return sign(getS3Client(), new GetObjectCommand({ Bucket: defaultBucket, Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  })
}

async function uploadReceiptToGcs(
  input: ReceiptUploadInput,
): Promise<ReceiptUploadResult> {
  const key = input.key ?? buildReceiptKey(input.userId, input.fileName)
  const storage = await getGcsStorage()
  const file = storage.bucket(server.GCS_RECEIPTS_BUCKET).file(key)
  await file.save(Buffer.from(input.body), {
    contentType: input.contentType,
    resumable: false,
    public: false,
    metadata: {
      contentType: input.contentType,
      metadata: { userId: input.userId },
    },
  })
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  })
  return { key, attachmentRef: toReceiptRef(key), url }
}

async function uploadReceiptToS3(
  input: ReceiptUploadInput,
): Promise<ReceiptUploadResult> {
  const key = input.key ?? buildReceiptKey(input.userId, input.fileName)
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: defaultBucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  )
  const url = await getS3SignedGetUrl(key)
  return { key, attachmentRef: toReceiptRef(key), url }
}

export async function uploadPrivateReceipt(
  input: ReceiptUploadInput,
): Promise<ReceiptUploadResult> {
  if (isGcsConfigured()) {
    return uploadReceiptToGcs(input)
  }
  if (isMinioConfigured()) {
    return uploadReceiptToS3(input)
  }
  throw new Error(
    'Receipt storage is not configured. Set GCS_RECEIPTS_BUCKET and GCS_SERVICE_ACCOUNT_JSON (staging/production), or MinIO for local dev.',
  )
}

export async function getReceiptSignedUrl(key: string, userId: string): Promise<string> {
  if (!isOwnedObjectKey(key, userId)) {
    throw new Error('Receipt not found')
  }

  if (isGcsConfigured()) {
    const storage = await getGcsStorage()
    const file = storage.bucket(server.GCS_RECEIPTS_BUCKET).file(key)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    })
    return url
  }

  if (!isMinioConfigured()) {
    throw new Error('Receipt storage is not configured')
  }

  return getS3SignedGetUrl(key)
}

export async function resolveAttachmentUrlForClient(
  attachmentUrl: string | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!attachmentUrl) return null
  if (!attachmentUrl.startsWith('mtd-receipt:')) return attachmentUrl
  const key = attachmentUrl.slice('mtd-receipt:'.length)
  try {
    return await getReceiptSignedUrl(key, userId)
  } catch (error) {
    console.info('[receipt-storage] signed url failed', {
      key,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function deletePrivateReceipt(
  attachmentUrl: string | null | undefined,
  userId: string,
) {
  const key = parseReceiptRef(attachmentUrl)
  if (!key) return
  if (!isOwnedObjectKey(key, userId)) {
    throw new Error('Receipt not found')
  }

  if (isGcsConfigured()) {
    const storage = await getGcsStorage()
    const file = storage.bucket(server.GCS_RECEIPTS_BUCKET).file(key)
    await file.delete({ ignoreNotFound: true })
    return
  }

  if (isMinioConfigured()) {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: defaultBucket,
        Key: key,
      }),
    )
    return
  }

  throw new Error('Receipt storage is not configured')
}
